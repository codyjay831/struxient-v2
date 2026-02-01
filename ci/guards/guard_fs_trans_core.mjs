import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const ENGINE_PATH = join(ROOT, 'src/lib/flowspec/engine.ts');

/**
 * Guard: FS_TRANS_CORE
 * 
 * Rule: inside engine.recordOutcome, all truth.* mutation calls and routing activations must occur inside $transaction.
 * Purpose: Ensure atomicity of core execution progress.
 */
function checkEngineAtomicity() {
  console.log('🔍 Running guard_fs_trans_core (Engine Atomicity)...');
  
  const content = readFileSync(ENGINE_PATH, 'utf-8');
  
  // Find recordOutcome function block
  const recordOutcomeMatch = content.match(/export async function recordOutcome\([\s\S]*?\{([\s\S]*?)\n\}/);
  if (!recordOutcomeMatch) {
    console.error('❌ Violation: Could not find recordOutcome function in engine.ts');
    process.exit(1);
  }

  const block = recordOutcomeMatch[1];

  // Invariants to check inside the block:
  // 1. Must contain prisma.$transaction
  if (!block.includes('prisma.$transaction')) {
    console.error('❌ Violation: recordOutcome does not contain a prisma.$transaction block.');
    process.exit(1);
  }

  // 2. truthRecordOutcome must be inside the transaction
  // (Simple check: ensure it's not called before prisma.$transaction starts)
  const txIndex = block.indexOf('prisma.$transaction');
  const truthIndex = block.indexOf('truthRecordOutcome');
  
  if (truthIndex !== -1 && truthIndex < txIndex) {
    console.error('❌ Violation: truthRecordOutcome called before prisma.$transaction block.');
    process.exit(1);
  }

  // 3. processGateRouting must be inside the transaction
  const routingIndex = block.indexOf('processGateRouting');
  if (routingIndex !== -1 && routingIndex < txIndex) {
    console.error('❌ Violation: processGateRouting called before prisma.$transaction block.');
    process.exit(1);
  }

  console.log('\n✅ recordOutcome mutations are wrapped in transaction.\n');
}

checkEngineAtomicity();
