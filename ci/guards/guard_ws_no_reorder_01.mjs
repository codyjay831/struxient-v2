import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const TARGET_DIRS = ['src/app/(app)/workstation', 'src/app/(app)/(fullbleed)/workstation'];

const FORBIDDEN_REORDER = [
  '.sort(',
  '.toSorted(',
  'orderBy',
  'sortBy',
  'reverse(',
  '.toReversed('
];

/**
 * Guard: WS_NO_REORDER_01 (Deterministic Order)
 * 
 * Rule: Work Station must NOT reorder task arrays locally.
 * Preserves the canonical sort from FlowSpec core.
 */
function checkNoReorder() {
  console.log('🔍 Running guard_ws_no_reorder_01 (No Reorder)...');
  
  let violations = 0;

  function scanDir(dir) {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const relPath = fullPath.replace(ROOT, '').replace(/\\/g, '/');
      
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        scanDir(fullPath);
      } else if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const content = readFileSync(fullPath, 'utf-8');
        
        FORBIDDEN_REORDER.forEach(token => {
          if (content.includes(token)) {
            console.error(`❌ Violation: Potential reorder mechanism "${token}" detected in ${relPath}.`);
            violations++;
          }
        });
      }
    }
  }

  TARGET_DIRS.forEach(dir => scanDir(join(ROOT, dir)));

  if (violations > 0) {
    console.error(`\n❌ guard_ws_no_reorder_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No client-side reordering detected in Work Station.\n');
}

checkNoReorder();
