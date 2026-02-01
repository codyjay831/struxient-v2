import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const FILES_TO_CHECK = [
  'src/lib/flowspec/analysis.ts',
  'src/app/api/flowspec/workflows/[id]/impact/route.ts',
  'src/app/api/flowspec/flows/[flowId]/diagnosis/route.ts',
];

const FORBIDDEN_IMPORTS = [
  'flowspec/truth',
  'flowspec/engine',
];

const FORBIDDEN_MUTATIONS = [
  /\.create\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /\.upsert\s*\(/,
  /\.createMany\s*\(/,
  /\.updateMany\s*\(/,
  /\.deleteMany\s*\(/,
];

/**
 * Guard: FS_ANALYSIS_READONLY
 * 
 * Rule: Analysis and Diagnosis modules MUST NOT import from truth/engine or perform mutations.
 * Purpose: Ensure analysis remains pure and behavior-neutral.
 */
function checkReadonly() {
  console.log('🔍 Running guard_fs_analysis_readonly (Analysis Read-Only Guard)...');
  
  let violations = 0;

  FILES_TO_CHECK.forEach(filePath => {
    const fullPath = join(ROOT, filePath);
    let content;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch (e) {
      console.warn(`⚠️ Warning: Could not read ${filePath}, skipping.`);
      return;
    }

    // Check imports (refined to avoid matching comments)
    FORBIDDEN_IMPORTS.forEach(imp => {
      const importRegex = new RegExp(`import.*from.*["']${imp}["']`, 'g');
      const requireRegex = new RegExp(`require\\(["']${imp}["']\\)`, 'g');
      if (importRegex.test(content) || requireRegex.test(content)) {
        console.error(`❌ Violation in ${filePath}: Forbidden import "${imp}".`);
        violations++;
      }
    });

    // Check mutations
    FORBIDDEN_MUTATIONS.forEach(regex => {
      if (regex.test(content)) {
        console.error(`❌ Violation in ${filePath}: Forbidden mutation pattern "${regex.toString()}".`);
        violations++;
      }
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_fs_analysis_readonly failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Analysis modules verified as read-only.\n');
}

checkReadonly();
