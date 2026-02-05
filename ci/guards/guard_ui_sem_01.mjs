import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const WORKSTATION_PATH = join(ROOT, 'src/app/(app)/(fullbleed)/workstation');

const FORBIDDEN_STRINGS = [
  "Tasks I can do",
  "My authorized tasks",
  "Tasks I have access to",
  "Permitted tasks",
  "Tasks I am Authorized",
];

/**
 * Guard: UI_SEM_01 (UI Language Guard)
 * 
 * Rule: Work Station UI MUST NOT use authorization/permission language for assignment filters.
 * Purpose: Prevent semantic confusion between Responsibility (Accountability) and Authority (Permission).
 */
function checkUILanguage() {
  console.log('🔍 Running guard_ui_sem_01 (UI Language Guard)...');
  
  if (!fs.existsSync(WORKSTATION_PATH)) {
    console.log('Skipping: Work Station directory not found.');
    return;
  }

  const files = getAllFiles(WORKSTATION_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      FORBIDDEN_STRINGS.forEach(forbidden => {
        if (line.includes(forbidden)) {
          const relativePath = file.replace(ROOT, '');
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden authorization language detected: "${forbidden}"`);
          violations++;
        }
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_ui_sem_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No UI language violations detected.\n');
}

import fs from 'fs';
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

checkUILanguage();
