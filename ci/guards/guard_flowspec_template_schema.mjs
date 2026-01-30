#!/usr/bin/env node
/**
 * guard_flowspec_template_schema.mjs
 * 
 * CI Guard: Enforce that all template definitions in the codebase satisfy the 
 * canonical FlowSpec schema (Zod + Structural).
 * 
 * Execution: Runs the vitest compliance test for templates.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, '../../tests/compliance/template_schema.test.ts');

console.log('🔍 Running guard_flowspec_template_schema...\n');

try {
  // Use cross-platform path to vitest
  const vitestBin = path.normalize('./node_modules/.bin/vitest');
  execSync(`${vitestBin} run ${TEST_FILE}`, { 
    stdio: 'inherit',
    shell: true 
  });
  
  console.log('\n✅ All templates are schema-compliant.\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Template schema validation failed. See vitest output above.\n');
  process.exit(1);
}
