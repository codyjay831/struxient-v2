import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const API_FLOWSPEC_PATH = join(ROOT, 'src/app/api/flowspec');

const FORBIDDEN_PATH_SEGMENTS = [
  'my-actionable',
  'my-tasks',
  'my_tasks',
  'myActionable',
];

/**
 * Guard: NO_MY_ACTIONABLE_01 (No "My Actionable" Endpoints)
 * 
 * Rule: src/app/api/flowspec/** MUST NOT contain routes/files for "my tasks" subsets.
 * Purpose: Block "convenience" endpoints that bypass the full canonical set rule.
 */
function checkNoMyActionable() {
  console.log('🔍 Running guard_no_my_actionable_01 (No "My Actionable" Endpoints)...');
  
  const files = getAllFiles(API_FLOWSPEC_PATH);
  let violations = 0;

  files.forEach(file => {
    const relativePath = file.replace(ROOT, '');
    
    FORBIDDEN_PATH_SEGMENTS.forEach(segment => {
      if (relativePath.toLowerCase().includes(segment.toLowerCase())) {
        console.error(`❌ Violation: Forbidden path segment "${segment}" detected in route:`);
        console.error(`   ${relativePath}`);
        violations++;
      }
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_no_my_actionable_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No "My Actionable" endpoints detected.\n');
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

checkNoMyActionable();
