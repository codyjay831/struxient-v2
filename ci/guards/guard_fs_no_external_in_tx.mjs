import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const ENGINE_PATH = join(ROOT, 'src/lib/flowspec/engine.ts');

const FORBIDDEN_IN_TX = [
  'executeFanOut',
  'fetch',
  'axios',
  'http',
];

/**
 * Guard: FS_NO_EXTERNAL_IN_TX
 * 
 * Rule: executeFanOut and other external side effects MUST NOT be inside a prisma.$transaction block.
 * Purpose: Prevent long-running external calls from holding DB locks open.
 */
function checkNoExternalInTx() {
  console.log('🔍 Running guard_fs_no_external_in_tx (No External in Transaction)...');
  
  const content = readFileSync(ENGINE_PATH, 'utf-8');
  
  // Find all prisma.$transaction blocks
  const txRegex = /prisma\.\$transaction\s*\(\s*(?:async\s*)?\([\s\S]*?\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  let violations = 0;

  while ((match = txRegex.exec(content)) !== null) {
    const txBlock = match[1];
    
    FORBIDDEN_IN_TX.forEach(token => {
      if (txBlock.includes(token)) {
        console.error(`❌ Violation: Forbidden token "${token}" found inside prisma.$transaction block.`);
        violations++;
      }
    });
  }

  if (violations > 0) {
    console.error(`\n❌ guard_fs_no_external_in_tx failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No external calls detected in transactions.\n');
}

checkNoExternalInTx();
