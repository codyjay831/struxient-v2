#!/usr/bin/env node
/**
 * guard_flowspec_status_mutation.mjs
 *
 * CI Guard: Prevent FlowSpec status mutation bypass.
 * Only lifecycle actions and the persistence gateway are allowed to mutate workflow status.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// Paths to scan
const SCAN_ROOT = join(ROOT, 'src');

// Allowed paths/files (where status mutation is permitted)
const ALLOWED_PATTERNS = [
  /^src\/lib\/flowspec\/lifecycle\/.*/,
  /^src\/lib\/flowspec\/persistence\/workflow\.ts$/
];

// Target tokens
const UPDATE_TOKEN = 'updateWorkflow(';
const STATUS_PATTERNS = [
  'status:',
  '.status'
];

class StatusMutationGuard {
  constructor() {
    this.violations = [];
  }

  isAllowed(relativePath) {
    return ALLOWED_PATTERNS.some(pattern => pattern.test(relativePath));
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const fullPath = join(dirPath, file);
        if (statSync(fullPath).isDirectory()) {
          // Skip common ignore dirs if they somehow ended up in src
          if (['node_modules', '.next', 'dist', 'build'].includes(file)) continue;
          this.getAllFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch {
      // Path might not exist
    }
    return arrayOfFiles;
  }

  checkFile(filePath) {
    const relativePath = relative(ROOT, filePath).replace(/\\/g, '/');

    if (this.isAllowed(relativePath)) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    
    // Check for updateWorkflow(
    if (!content.includes(UPDATE_TOKEN)) {
      return;
    }

    // Check for status tokens
    const foundStatusToken = STATUS_PATTERNS.find(token => content.includes(token));
    
    if (foundStatusToken) {
      // Find line number for better reporting
      const lines = content.split('\n');
      let updateLine = -1;
      let statusLine = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(UPDATE_TOKEN)) updateLine = i + 1;
        if (lines[i].includes(foundStatusToken)) statusLine = i + 1;
      }

      this.violations.push({
        file: relativePath,
        updateLine,
        statusLine,
        token: foundStatusToken,
        snippet: lines[updateLine - 1]?.trim() || lines[statusLine - 1]?.trim()
      });
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_status_mutation...\n');

    const allFiles = this.getAllFiles(SCAN_ROOT);
    console.log(`   Scanning ${allFiles.length} files in src/...\n`);

    for (const file of allFiles) {
      this.checkFile(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ No unauthorized FlowSpec status mutations detected.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} unauthorized status mutation risk(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [STATUS_BYPASS_RISK] ${v.file}`);
      console.log(`    updateWorkflow( found on line ${v.updateLine}`);
      console.log(`    '${v.token}' found on line ${v.statusLine}`);
      console.log(`    Snippet: ${v.snippet}`);
      console.log('');
    }

    console.log('Policy: Workflow status MUST only be mutated via lifecycle actions.');
    console.log('Allowed locations:');
    console.log('  - src/lib/flowspec/lifecycle/**');
    console.log('  - src/lib/flowspec/persistence/workflow.ts\n');
    console.log('If you are trying to change workflow status, use the lifecycle actions instead.');
    return 1;
  }
}

try {
  const guard = new StatusMutationGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
