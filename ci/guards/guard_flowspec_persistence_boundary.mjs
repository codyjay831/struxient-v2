#!/usr/bin/env node
// guard_flowspec_persistence_boundary.mjs
//
// CI Guard: Enforce that all prisma.workflow write operations in FlowSpec
// code paths go through the persistence gateway.
//
// Scanned Paths:
//   src/app/api/flowspec/ (all .ts files)
//   src/lib/flowspec/ (all .ts files)
//
// Forbidden Patterns:
//   prisma.workflow.create(
//   prisma.workflow.update(
//   prisma.workflow.upsert(
//   prisma.workflow.createMany(
//   prisma.workflow.updateMany(
//   prisma.workflow.delete(
//   prisma.workflow.deleteMany(
//
// Allowed Exception:
//   src/lib/flowspec/persistence/workflow.ts (the gateway itself)

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// Paths to scan for violations
const SCAN_PATHS = [
  join(ROOT, 'src/app/api/flowspec'),
  join(ROOT, 'src/lib/flowspec'),
];

// The gateway file that is allowed to use prisma.workflow.*
const ALLOWED_FILE = 'src/lib/flowspec/persistence/workflow.ts';

// Forbidden patterns (raw prisma.workflow.* or tx.workflow.* calls)
const FORBIDDEN_PATTERNS = [
  { pattern: /(prisma|tx)\.workflow\.create\s*\(/g, method: 'create' },
  { pattern: /(prisma|tx)\.workflow\.update\s*\(/g, method: 'update' },
  { pattern: /(prisma|tx)\.workflow\.upsert\s*\(/g, method: 'upsert' },
  { pattern: /(prisma|tx)\.workflow\.createMany\s*\(/g, method: 'createMany' },
  { pattern: /(prisma|tx)\.workflow\.updateMany\s*\(/g, method: 'updateMany' },
  { pattern: /(prisma|tx)\.workflow\.delete\s*\(/g, method: 'delete' },
  { pattern: /(prisma|tx)\.workflow\.deleteMany\s*\(/g, method: 'deleteMany' },
];

class PersistenceBoundaryGuard {
  constructor() {
    this.violations = [];
  }

  getAllTsFiles(dirPath, arrayOfFiles = []) {
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const fullPath = join(dirPath, file);
        if (statSync(fullPath).isDirectory()) {
          this.getAllTsFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch {
      // Path might not exist yet
    }
    return arrayOfFiles;
  }

  checkFile(filePath) {
    const relativePath = relative(ROOT, filePath).replace(/\\/g, '/');

    // Skip the gateway file itself
    if (relativePath === ALLOWED_FILE) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');

    for (const { pattern, method } of FORBIDDEN_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          this.violations.push({
            file: relativePath,
            method,
            match: match.trim(),
          });
        }
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_persistence_boundary...\n');

    // Collect all TS files from scan paths
    const allFiles = [];
    for (const scanPath of SCAN_PATHS) {
      this.getAllTsFiles(scanPath, allFiles);
    }

    console.log(`   Scanning ${allFiles.length} files...\n`);

    for (const file of allFiles) {
      this.checkFile(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ No persistence boundary violations detected.\n');
      console.log(`   All prisma.workflow.* calls are routed through ${ALLOWED_FILE}\n`);
      return 0;
    }

    console.log(`❌ ${this.violations.length} persistence boundary violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [BOUNDARY_VIOLATION] ${v.file}`);
      console.log(`    Method: prisma.workflow.${v.method}()`);
      console.log(`    Found: ${v.match}`);
      console.log('');
    }

    console.log('All prisma.workflow.* write operations must go through:');
    console.log(`  ${ALLOWED_FILE}\n`);
    console.log('Import and use the gateway functions instead:');
    console.log('  - createWorkflow()');
    console.log('  - createWorkflowFromTemplate()');
    console.log('  - updateWorkflow()');
    console.log('  - deleteWorkflow()');
    return 1;
  }
}

try {
  const guard = new PersistenceBoundaryGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
