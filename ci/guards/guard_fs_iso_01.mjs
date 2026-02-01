import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const FLOWSPEC_LIB_PATH = join(ROOT, 'src/lib/flowspec');

const FORBIDDEN_IMPORTS = [
  '@/lib/responsibility',
  '../responsibility',
  '../../responsibility',
];

/**
 * Guard: FS_ISO_01 (FlowSpec Isolation)
 * 
 * Rule: src/lib/flowspec/** MUST NOT import from the Responsibility domain.
 * Purpose: Ensure Responsibility remain pure metadata and does not bleed into FlowSpec engine.
 */
function checkFlowSpecIsolation() {
  console.log('🔍 Running guard_fs_iso_01 (FlowSpec Isolation)...');
  
  const files = getAllFiles(FLOWSPEC_LIB_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      FORBIDDEN_IMPORTS.forEach(forbidden => {
        if (line.includes('import') && line.includes(forbidden)) {
          const relativePath = file.replace(ROOT, '');
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden import detected: "${forbidden}"`);
          console.error(`   Line: ${line.trim()}`);
          violations++;
        }
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_fs_iso_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No FlowSpec isolation violations detected.\n');
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

checkFlowSpecIsolation();
