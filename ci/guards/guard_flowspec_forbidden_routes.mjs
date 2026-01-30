#!/usr/bin/env node
/**
 * guard_flowspec_forbidden_routes.mjs
 * 
 * CI Guard: Block API routes that would violate FlowSpec invariants.
 * 
 * Canon Source: implementation_plan.md §10.2, 50_flowspec_builder_ui_api_map.md §4
 * Milestone: M1 (must pass before EPIC-07 code)
 * 
 * Invariants Protected:
 * - INV-007: Outcome Immutability (No Outcome PATCH/DELETE)
 * - Evidence Immutability (No Evidence DELETE)
 * - INV-011: Published Immutable (No WorkflowVersion PATCH)
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_PATH = join(__dirname, '../../src/app/api/flowspec');

// Forbidden route patterns: { method: string, pathRegex: RegExp }
const FORBIDDEN_PATTERNS = [
  {
    method: 'PATCH',
    pathRegex: /\/flows\/\[flowId\]\/tasks\/\[taskId\]\/outcome/i,
    reason: 'Mutating recorded Outcome violates INV-007 (Outcome Immutability)',
  },
  {
    method: 'DELETE',
    pathRegex: /\/flows\/\[flowId\]\/tasks\/\[taskId\]\/outcome/i,
    reason: 'Deleting recorded Outcome violates INV-007 (Outcome Immutability)',
  },
  {
    method: 'DELETE',
    pathRegex: /\/flows\/\[flowId\]\/tasks\/\[taskId\]\/evidence/i,
    reason: 'Evidence is append-only and cannot be deleted',
  },
  {
    method: 'PATCH',
    pathRegex: /\/workflows\/\[id\]\/versions\/\[versionId\]/i,
    reason: 'Published versions are immutable (INV-011)',
  },
  {
    method: 'PATCH',
    pathRegex: /\/flows\/\[flowId\]$/i,
    reason: 'Flow version binding is permanent (INV-010)',
  },
  // Template immutability - updates require new version row
  {
    method: 'PATCH',
    pathRegex: /\/templates\/\[id\]$/i,
    reason: 'Templates are immutable. Updates require inserting a new version row.',
  },
  {
    method: 'DELETE',
    pathRegex: /\/templates\/\[id\]$/i,
    reason: 'Templates cannot be deleted (system-defined only in v1)',
  },
];

class ForbiddenRoutesGuard {
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
        } else if (file === 'route.ts' || file === 'route.js' || file === 'route.mjs') {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch {
      // Path might not exist yet
    }
    return arrayOfFiles;
  }

  isMethodExported(content, method) {
    // Remove block comments
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    const lines = cleanContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) continue;

      // Simple exports: export const PATCH, export async function PATCH
      const simpleExport = new RegExp(`export\\s+(const|async\\s+function)\\s+${method}\\b`);
      if (simpleExport.test(trimmed)) return true;

      // Braced exports: export { PATCH }, export { a, b as PATCH }
      const bracedExport = /export\s+\{([^}]+)\}/g;
      let match;
      while ((match = bracedExport.exec(trimmed)) !== null) {
        const exports = match[1].split(',').map(e => e.trim());
        for (const exp of exports) {
          if (exp === method) return true;
          if (exp.endsWith(` as ${method}`)) return true;
        }
      }
    }
    return false;
  }

  checkRoute(filePath) {
    const relativePath = relative(API_PATH, filePath).replace(/\\/g, '/');
    const routeDir = '/' + dirname(relativePath);
    
    const content = readFileSync(filePath, 'utf8');
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.pathRegex.test(routeDir)) {
        if (this.isMethodExported(content, pattern.method)) {
          this.violations.push({
            file: join('src/app/api/flowspec', relativePath).replace(/\\/g, '/'),
            method: pattern.method,
            reason: pattern.reason,
          });
        }
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_forbidden_routes...\n');

    const routeFiles = this.getAllRouteFiles(API_PATH);
    for (const file of routeFiles) {
      this.checkRoute(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ No forbidden routes detected.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} forbidden route(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [FORBIDDEN_ROUTE] ${v.file}`);
      console.log(`    Method: ${v.method}`);
      console.log(`    Reason: ${v.reason}`);
      console.log('');
    }

    console.log('Forbidden routes violate core FlowSpec invariants and must not be implemented.');
    return 1;
  }
}

try {
  const guard = new ForbiddenRoutesGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
