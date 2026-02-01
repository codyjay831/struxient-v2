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
];

/**
 * Guard: FS_JOIN_01 (FlowSpec JOIN Guard)
 * 
 * Rule: src/lib/flowspec/** MUST NOT traverse into Responsibility models via Prisma include/select.
 * Purpose: Block Responsibility traversal that would bypass the API boundary.
 */
function checkFlowSpecJoin() {
  console.log('🔍 Running guard_fs_join_01 (FlowSpec JOIN Guard)...');
  
  const files = getAllFiles(FLOWSPEC_LIB_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

    const content = readFileSync(file, 'utf-8');
    
    // Check for Prisma traversal patterns: include: { job: ... } OR tokens
    // We scan for include/select followed by anything that mentions our tokens
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      FORBIDDEN_TOKENS.forEach(token => {
        // Simple token detection for now as a proxy for traversal
        if (line.includes(token)) {
          // Special case: ignore if it's a comment
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

          const relativePath = file.replace(ROOT, '');
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden Responsibility token detected: "${token}"`);
          console.error(`   Line: ${line.trim()}`);
          violations++;
        }
      });

      // Specific check for include: { job: ... }
      if (line.includes('include:') && line.includes('job:')) {
        const relativePath = file.replace(ROOT, '');
        console.error(`❌ Violation in ${relativePath}:${index + 1}`);
        console.error(`   Forbidden Job traversal detected in include.`);
        console.error(`   Line: ${line.trim()}`);
        violations++;
      }
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_fs_join_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No FlowSpec JOIN violations detected.\n');
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

checkFlowSpecJoin();
