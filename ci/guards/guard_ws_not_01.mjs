import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const API_FLOWSPEC_PATH = join(ROOT, 'src/app/api/flowspec');
const WORKSTATION_PATH = join(ROOT, 'src/app/(app)/workstation');

const FORBIDDEN_IMPORTS = [
  'bull',
  'bullmq',
  'ioredis',
  'pg-boss',
  '@aws-sdk/client-sqs',
  '@/lib/notifications',
  '../notifications',
  '../../notifications',
];

const FORBIDDEN_CALLS = [
  '.enqueue(',
  '.publish(',
  '.emit(',
  '.lpush(',
  '.rpush(',
];

/**
 * Guard: WS_NOT_01 (Work Station Notification Guard)
 * 
 * Rule: Work Station UI or API routes MUST NOT trigger or enqueue notifications.
 * Purpose: Enforce observer-only triggering from FlowSpec Truth emissions only.
 */
function checkWSNotifications() {
  console.log('🔍 Running guard_ws_not_01 (Work Station Notification Guard)...');
  
  const paths = [API_FLOWSPEC_PATH, WORKSTATION_PATH];
  let violations = 0;

  paths.forEach(path => {
    if (!fs.existsSync(path)) return;
    const files = getAllFiles(path);

    files.forEach(file => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for forbidden imports
        FORBIDDEN_IMPORTS.forEach(forbidden => {
          if (line.includes('import') && line.includes(forbidden)) {
            const relativePath = file.replace(ROOT, '');
            console.error(`❌ Violation in ${relativePath}:${index + 1}`);
            console.error(`   Forbidden notification/queue import detected: "${forbidden}"`);
            violations++;
          }
        });

        // Check for forbidden calls
        FORBIDDEN_CALLS.forEach(call => {
          if (line.includes(call)) {
            const relativePath = file.replace(ROOT, '');
            console.error(`❌ Violation in ${relativePath}:${index + 1}`);
            console.error(`   Forbidden queue/notification call detected: "${call}"`);
            violations++;
          }
        });
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_ws_not_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No Work Station notification violations detected.\n');
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

checkWSNotifications();
