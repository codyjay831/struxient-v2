#!/usr/bin/env node
/**
 * guard_canvas_ux_contract.mjs
 * 
 * CI Guard: Enforce Canvas UX Contract v1.1
 * 
 * Rules:
 * 1. Canvas code must NOT import FlowSpec engine internals (@/lib/flowspec/engine, truth, derived)
 * 2. Canvas layout code must NOT contain semantic priority terms
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

class CanvasUXContractGuard {
  constructor() {
    this.violations = [];
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    if (!existsSync(dirPath)) return arrayOfFiles;
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
    } catch { /* ignore */ }
    return arrayOfFiles;
  }

  checkCanvasTruthBoundary() {
    const canvasDirs = [
      join(ROOT, 'src/lib/canvas'),
      join(ROOT, 'src/components/canvas')
    ];
    const forbidden = [
      'lib/flowspec/engine',
      'lib/flowspec/truth',
      'lib/flowspec/derived'
    ];
    
    let files = [];
    for (const dir of canvasDirs) {
      files = files.concat(this.getAllFiles(dir));
    }

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const relativePath = relative(ROOT, file).replace(/\\/g, '/');

      for (const pattern of forbidden) {
        // Look for imports from forbidden internals
        const importRegex = new RegExp(`from\\s+['"].*${pattern}['"]`, 'g');
        if (importRegex.test(content)) {
          this.violations.push({
            code: 'CANVAS_TRUTH_BOUNDARY',
            file: relativePath,
            message: `Canvas code "${relativePath}" directly imports forbidden FlowSpec core logic "${pattern}". Canvas must be orientation-only.`,
          });
        }
      }
    }
  }

  checkNoSemanticDrift() {
    const layoutPath = join(ROOT, 'src/lib/canvas/layout.ts');
    if (!existsSync(layoutPath)) return;

    const content = readFileSync(layoutPath, 'utf-8').toLowerCase();
    const relativePath = relative(ROOT, layoutPath).replace(/\\/g, '/');
    const forbidden = ['happy path', 'priority', 'success path', 'primary outcome', 'best path'];

    for (const term of forbidden) {
      if (content.includes(term)) {
        this.violations.push({
          code: 'SEMANTIC_DRIFT',
          file: relativePath,
          message: `Layout code "${relativePath}" contains semantic priority term "${term}". Spine must use topology only.`,
        });
      }
    }
  }

  checkForbiddenTerms() {
    const scanDirs = [
      join(ROOT, 'src/app/(app)/flowspec'),
      join(ROOT, 'src/components/flowspec'),
      join(ROOT, 'src/components/canvas')
    ];
    
    const forbiddenWords = ['reset', 'retry', 'rollback', 'rewind', 'redo'];
    const forbiddenPhrases = [/start\s+over/];
    
    let files = [];
    for (const dir of scanDirs) {
      files = files.concat(this.getAllFiles(dir));
    }

    for (const file of files) {
      const content = readFileSync(file, 'utf-8').toLowerCase();
      const relativePath = relative(ROOT, file).replace(/\\/g, '/');

      // Check whole words
      for (const word of forbiddenWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        if (regex.test(content)) {
          this.violations.push({
            code: 'FORBIDDEN_TERM',
            file: relativePath,
            message: `File contains forbidden term "${word}".`,
          });
        }
      }

      // Check phrases
      for (const phraseRegex of forbiddenPhrases) {
        if (phraseRegex.test(content)) {
          this.violations.push({
            code: 'FORBIDDEN_PHRASE',
            file: relativePath,
            message: `File contains forbidden phrase "${phraseRegex.source}".`,
          });
        }
      }
    }
  }

  run() {
    console.log('🔍 Running guard_canvas_ux_contract...\n');

    this.checkCanvasTruthBoundary();
    this.checkNoSemanticDrift();
    this.checkForbiddenTerms();

    if (this.violations.length === 0) {
      console.log('✅ Canvas UX Contract respected.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} contract violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [${v.code}] ${v.file}`);
      console.log(`    ${v.message}\n`);
    }

    return 1;
  }
}

try {
  const guard = new CanvasUXContractGuard();
  process.exit(guard.run());
} catch (error) {
  console.error('❌ Error running guard:', error.message);
  process.exit(1);
}
