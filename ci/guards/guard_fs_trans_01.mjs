import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const FLOWSPEC_LIB_PATH = join(ROOT, 'src/lib/flowspec');

const FORBIDDEN_TOKENS = [
  'JobAssignment',
  'ExternalParty',
  'assignments',
  'prisma.jobAssignment',
  'prisma.externalParty',
];

/**
 * Guard: FS_TRANS_01 (FlowSpec Transaction Purity)
 * 
 * Rule: src/lib/flowspec/** MUST NOT touch Responsibility tables within a prisma.$transaction block.
 * Purpose: Protect FlowSpec transaction purity and prevent locking/coupling.
 */
function checkFlowSpecTransactions() {
  console.log('🔍 Running guard_fs_trans_01 (FlowSpec Transaction Purity)...');
  
  const files = getAllFiles(FLOWSPEC_LIB_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

    const content = readFileSync(file, 'utf-8');
    
    // Detect prisma.$transaction blocks and then check for forbidden tokens within them
    // This is a simple regex-based multi-line scan
    const transactionRegex = /prisma\.\$transaction\s*\(\s*(\[[\s\S]*?\]|\async[\s\S]*?\{[\s\S]*?\})\s*\)/g;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const block = match[0];
      FORBIDDEN_TOKENS.forEach(token => {
        if (block.includes(token)) {
          const relativePath = file.replace(ROOT, '');
          console.error(`❌ Violation in ${relativePath}`);
          console.error(`   Forbidden Responsibility token "${token}" found inside prisma.$transaction block.`);
          violations++;
        }
      });
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_fs_trans_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No FlowSpec transaction violations detected.\n');
}

function getAllFiles(dirPath, arrayOfFiles) {
  const files = readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

checkFlowSpecTransactions();
