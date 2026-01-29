#!/usr/bin/env node
/**
 * guard_flowspec_route_tenant_check.mjs
 * 
 * CI Guard: Verify all FlowSpec API routes call tenant validation before processing.
 * 
 * Canon Source: implementation_plan.md §10.2, §1.3.2
 * Milestone: M1 (must pass before EPIC-07 code)
 * 
 * Boundary Protected: Tenant Isolation (companyId boundary)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_PATH = join(__dirname, '../../src/app/api/flowspec');

// The required validation calls
const REQUIRED_VALIDATION_CALLS = ['verifyTenantOwnership', 'getActorCompanyId', 'getActorTenantContext'];

class RouteTenantCheckGuard {
  constructor() {
    this.violations = [];
  }

  getAllRouteFiles(dirPath, arrayOfFiles = []) {
    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        const fullPath = join(dirPath, file);
        if (statSync(fullPath).isDirectory()) {
          this.getAllRouteFiles(fullPath, arrayOfFiles);
        } else if (file === 'route.ts') {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch {
      // Path might not exist yet
    }
    return arrayOfFiles;
  }

  checkFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(join(__dirname, '../..'), filePath).replace(/\\/g, '/');

    // Skip checking if it doesn't export HTTP method handlers
    const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
    const hasMethods = methods.some(m => content.includes(`export async function ${m}`));
    
    if (!hasMethods) return;

    // Check if each method calls at least one validation helper
    for (const method of methods) {
      const methodRegex = new RegExp(`export\\s+async\\s+function\\s+${method}[^\\{]*\\{([\\s\\S]*?)(?=export\\s+async|$)`, 'g');
      let match;
      while ((match = methodRegex.exec(content)) !== null) {
        const methodBody = match[1];
        const hasValidation = REQUIRED_VALIDATION_CALLS.some(call => methodBody.includes(call));
        if (!hasValidation) {
          this.violations.push({
            file: relativePath,
            method: method,
            message: `Route handler ${method} in "${relativePath}" does not call any of [${REQUIRED_VALIDATION_CALLS.join(', ')}]. All FlowSpec routes must enforce tenant isolation.`,
          });
        }
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_route_tenant_check...\n');

    const routeFiles = this.getAllRouteFiles(API_PATH);
    for (const file of routeFiles) {
      this.checkFile(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ All FlowSpec routes enforce tenant isolation.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} tenant isolation violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [TENANT_ISOLATION_VIOLATION] ${v.file}`);
      console.log(`    Method: ${v.method}`);
      console.log(`    Message: ${v.message}`);
      console.log('');
    }

    console.log('All FlowSpec API routes MUST call "verifyTenantOwnership" or "getActorCompanyId" to prevent cross-tenant data access.');
    return 1;
  }
}

try {
  const guard = new RouteTenantCheckGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
