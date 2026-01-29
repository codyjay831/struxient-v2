/**
 * CI Guard Runner
 * 
 * Runs all guard scripts in the ci/guards directory.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARDS_DIR = path.join(__dirname, 'guards');

async function runGuards() {
  console.log('=== Running CI Guards ===\n');
  
  const guards = fs.readdirSync(GUARDS_DIR).filter(f => f.endsWith('.mjs'));
  let failureCount = 0;

  for (const guard of guards) {
    const guardPath = path.join(GUARDS_DIR, guard);
    try {
      execSync(`node ${guardPath}`, { stdio: 'inherit' });
      console.log(`\n✅ ${guard} passed.\n`);
    } catch (error) {
      console.error(`\n❌ ${guard} failed.\n`);
      failureCount++;
    }
  }

  console.log('=========================');
  if (failureCount > 0) {
    console.log(`Total Failures: ${failureCount}`);
    process.exit(1);
  } else {
    console.log('All guards passed!');
    process.exit(0);
  }
}

runGuards();
