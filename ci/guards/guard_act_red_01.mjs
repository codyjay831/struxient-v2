import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const API_FLOWSPEC_PATH = join(ROOT, 'src/app/api/flowspec');

/**
 * Guard: ACT_RED_01 (Actionable Task Reduction)
 * 
 * Rule: src/app/api/flowspec/** MUST NOT filter actionable tasks by identity or assignment on the server.
 * Purpose: Ensure Canonical Actionable Set is identical for all members.
 */
function checkActionableReduction() {
  console.log('🔍 Running guard_act_red_01 (Actionable Task Reduction)...');
  
  const files = getAllFiles(API_FLOWSPEC_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for identity-based filtering in WHERE clauses
      if (line.includes('where:') && (line.includes('assigneeId') || line.includes('userId') || line.includes('assignedTo'))) {
        const relativePath = file.replace(ROOT, '');
        console.error(`❌ Violation in ${relativePath}:${index + 1}`);
        console.error(`   Identity-based filtering detected in WHERE clause.`);
        console.error(`   Line: ${line.trim()}`);
        violations++;
      }

      // Check for tasks.filter(...) predicates referencing identity
      if (line.includes('.filter(') && (line.includes('userId') || line.includes('assigneeId') || line.includes('assignedTo'))) {
        const relativePath = file.replace(ROOT, '');
        console.error(`❌ Violation in ${relativePath}:${index + 1}`);
        console.error(`   Identity-based filtering detected in array filter.`);
        console.error(`   Line: ${line.trim()}`);
        violations++;
      }
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_act_red_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No Actionable reduction violations detected.\n');
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

checkActionableReduction();
