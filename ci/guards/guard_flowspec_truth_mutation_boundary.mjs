#!/usr/bin/env node
/**
 * guard_flowspec_truth_mutation_boundary.mjs
 * 
 * CI Guard: Ensure only FlowSpec modules can import and invoke Truth mutation functions.
 * 
 * Canon Source: implementation_plan.md §10.2, 20_flowspec_invariants.md INV-009
 * Milestone: M0 (must pass before EPIC-01 code)
 * 
 * Invariant Protected: INV-009 (FlowSpec Owns Truth)
 * 
 * Rule: Only src/lib/flowspec/** may import Truth mutation functions.
 *       External domains (Work Station, Sales, Finance, Admin) must NOT directly mutate Truth.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(__dirname, '../../src');

// Truth mutation functions that are protected
// These are the functions that modify execution Truth and must ONLY be called from src/lib/flowspec/**
const TRUTH_MUTATION_FUNCTIONS = [
  'recordNodeActivation',
  'recordTaskStart',
  'recordOutcome',
  'attachEvidence',
  // Add more as they are defined
];

// Truth module paths (these are allowed to define and use Truth mutations)
const ALLOWED_IMPORT_PATHS = [
  'src/lib/flowspec/',
  'src\\lib\\flowspec\\', // Windows path
  'src/app/api/flowspec/',
  'src\\app\\api\\flowspec\\', // Windows path
];

// Files/directories to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  '.git',
  'ci/guards', // Guards themselves
  'tests/', // Test files may import for testing
  'tests\\', // Windows
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
];

class TruthMutationBoundaryGuard {
  constructor() {
    this.violations = [];
  }

  shouldSkip(filePath) {
    return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
  }

  isAllowedPath(filePath) {
    const relativePath = relative(join(__dirname, '../..'), filePath).replace(/\\/g, '/');
    return ALLOWED_IMPORT_PATHS.some(allowed => relativePath.startsWith(allowed.replace(/\\/g, '/')));
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        const fullPath = join(dirPath, file);
        
        if (this.shouldSkip(fullPath)) {
          continue;
        }

        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            this.getAllFiles(fullPath, arrayOfFiles);
          } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            arrayOfFiles.push(fullPath);
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return arrayOfFiles;
  }

  checkFile(filePath) {
    // If file is in allowed path, skip checking
    if (this.isAllowedPath(filePath)) {
      return;
    }

    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    // Check for direct Truth mutation function calls or imports
    for (const funcName of TRUTH_MUTATION_FUNCTIONS) {
      // Check for import statements
      const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${funcName}\\b[^}]*\\}\\s*from`, 'g');
      const callRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');

      if (importRegex.test(content) || callRegex.test(content)) {
        const relativePath = relative(join(__dirname, '../..'), filePath);
        this.violations.push({
          file: relativePath,
          function: funcName,
          message: `File "${relativePath}" imports or calls Truth mutation function "${funcName}". Only src/lib/flowspec/** may mutate Truth (INV-009).`,
        });
      }
    }

    // Check for direct Prisma imports of Truth tables (bypassing the engine)
    const truthTablePatterns = [
      /prisma\.taskExecution\.(create|update|delete|upsert)/gi,
      /prisma\.nodeActivation\.(create|update|delete|upsert)/gi,
      /prisma\.evidenceAttachment\.(create|update|delete|upsert)/gi,
    ];

    for (const pattern of truthTablePatterns) {
      if (pattern.test(content)) {
        const relativePath = relative(join(__dirname, '../..'), filePath);
        this.violations.push({
          file: relativePath,
          function: 'direct Prisma Truth mutation',
          message: `File "${relativePath}" directly mutates Truth tables via Prisma. Only src/lib/flowspec/** may mutate Truth (INV-009).`,
        });
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_truth_mutation_boundary...\n');

    const files = this.getAllFiles(SRC_PATH);
    
    for (const file of files) {
      this.checkFile(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ Truth mutation boundary enforced. No violations found.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} Truth mutation boundary violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [TRUTH_BOUNDARY_VIOLATION] ${v.message}`);
      console.log(`    Function: ${v.function}`);
      console.log('');
    }

    console.log('Fix these violations before proceeding.');
    console.log('External domains must call FlowSpec APIs, not mutate Truth directly.');
    console.log('See: 20_flowspec_invariants.md INV-009\n');
    return 1;
  }
}

// Main execution
try {
  const guard = new TruthMutationBoundaryGuard();
  const exitCode = guard.run();
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
