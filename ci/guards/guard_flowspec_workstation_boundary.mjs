#!/usr/bin/env node
/**
 * guard_flowspec_workstation_boundary.mjs
 * 
 * CI Guard: Enforce domain boundary between Work Station and FlowSpec Engine.
 * 
 * Canon Source: implementation_plan.md §10.2, epic_08_workstation_integration.md §9
 * Milestone: M3 (must pass before EPIC-08 completion)
 * 
 * Rule: Work Station code (UI/Pages) MUST NOT directly import FlowSpec core logic.
 * Coordination must happen via API or the high-level FlowSpec public interface (if allowed).
 * Actually, per Epic 08 §9, it specifically blocks engine.ts, derived.ts, and truth.ts.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSTATION_PATH = join(__dirname, '../../src/app/(app)/workstation');
const FORBIDDEN_IMPORTS = [
  'lib/flowspec/engine',
  'lib/flowspec/derived',
  'lib/flowspec/truth',
];

class WorkstationBoundaryGuard {
  constructor() {
    this.violations = [];
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        const fullPath = join(dirPath, file);
        if (statSync(fullPath).isDirectory()) {
          this.getAllFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
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

    for (const forbidden of FORBIDDEN_IMPORTS) {
      // Look for imports like: import { ... } from "@/lib/flowspec/engine"
      // or: import * from "../../lib/flowspec/engine"
      const importRegex = new RegExp(`from\\s+['"].*${forbidden}['"]`, 'g');
      if (importRegex.test(content)) {
        this.violations.push({
          file: relativePath,
          forbidden,
          message: `Work Station file "${relativePath}" directly imports forbidden FlowSpec core logic "${forbidden}". Work Station must interact with FlowSpec via API only.`,
        });
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_workstation_boundary...\n');

    const files = this.getAllFiles(WORKSTATION_PATH);
    for (const file of files) {
      this.checkFile(file);
    }

    if (this.violations.length === 0) {
      console.log('✅ Work Station domain boundary respected.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} boundary violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [BOUNDARY_VIOLATION] ${v.file}`);
      console.log(`    Forbidden Import: ${v.forbidden}`);
      console.log(`    Message: ${v.message}`);
      console.log('');
    }

    console.log('Work Station must remain a pure consumer of FlowSpec. Do not import core logic into UI code.');
    return 1;
  }
}

try {
  const guard = new WorkstationBoundaryGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
