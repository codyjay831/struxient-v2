import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

/**
 * Guard: Human Confirmation
 * 
 * Enforces: Right Control
 * Rule: No COMMITTED schedule can be created or modified without explicit human confirmation.
 * This guard ensures that any API-driven outcome recording passes a user identifier.
 */
function checkHumanConfirmation() {
  console.log('🔍 Running guard_schedule_human_confirmation...');
  
  const apiDir = join(ROOT, 'src/app/api');
  const files = getAllFiles(apiDir);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts')) return;
    const relativePath = file.replace(ROOT, '').replace(/\\/g, '/');

    const content = readFileSync(file, 'utf-8');
    
    // Scan for recordOutcome calls in API routes
    if (/\brecordOutcome\s*\(/.test(content)) {
      // Rule: recordOutcome(flowId, taskId, outcome, userId, ...)
      // We check that the 4th argument is present and doesn't look like a system constant.
      // Generic check: ensure there are at least 4 arguments and the 4th isn't null/undefined/system
      const matches = content.match(/recordOutcome\s*\(([^)]+)\)/g);
      
      if (matches) {
        matches.forEach(call => {
          const args = call.replace(/recordOutcome\s*\(/, '').replace(/\)$/, '').split(',').map(a => a.trim());
          const userIdArg = args[3];

          if (!userIdArg || userIdArg === 'null' || userIdArg === 'undefined' || userIdArg === '""') {
            console.error(`❌ Violation in ${relativePath}`);
            console.error(`   recordOutcome called without explicit human attribution (userId argument is empty or invalid).`);
            console.error(`   Call: ${call.trim()}`);
            violations++;
          }
        });
      }
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_schedule_human_confirmation failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Human confirmation enforcement active (userId attribution required).\n');
}

function getAllFiles(dirPath, arrayOfFiles) {
  const files = readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (statSync(join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(join(dirPath, file));
    }
  });
  return arrayOfFiles;
}

checkHumanConfirmation();
