import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SCHEDULING_COMMIT_SURFACES } from './scheduling_boundary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

/**
 * Guard: Schedule Truth Sources
 * 
 * Enforces: Right Truth
 * Rule: Only task outcomes or detour-confirmed outcomes may mutate Committed schedule truth.
 * This guard ensures recordOutcome is only called from authorized core/test layers.
 */
function checkTruthSources() {
  console.log('🔍 Running guard_schedule_truth_sources...');
  
  const files = getAllFiles(ROOT);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
    const relativePath = file.replace(ROOT, '').replace(/\\/g, '/');

    // Rule 1: Allow calls from core layers and tests
    const isAllowedLayer = SCHEDULING_COMMIT_SURFACES.ALLOWED_LAYERS.some(layer => 
      relativePath.startsWith(layer)
    );
    
    // Exception: The API outcome route is allowed to call the engine
    const isAllowedApiRoute = relativePath === 'src/app/api/flowspec/flows/[flowId]/tasks/[taskId]/outcome/route.ts';

    if (isAllowedLayer || isAllowedApiRoute) {
      return;
    }

    // Rule 2: Forbid calls from specific layers (UI, workstation, calendar, etc.)
    const isForbiddenLayer = SCHEDULING_COMMIT_SURFACES.FORBIDDEN_LAYERS.some(layer => 
      relativePath.startsWith(layer)
    );

    const content = readFileSync(file, 'utf-8');
    
    // Check for recordOutcome calls outside allowed surfaces
    if (/\brecordOutcome\s*\(/.test(content)) {
      // Don't flag the definition itself in truth.ts or engine.ts (though they are in ALLOWED_LAYERS)
      // This is a safety check for layers that are NEITHER allowed NOR explicitly forbidden
      console.error(`❌ Violation in ${relativePath}`);
      console.error(`   Direct recordOutcome call detected outside authorized layers.`);
      violations++;
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_schedule_truth_sources failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Schedule truth source tracking active (layer-based restriction).\n');
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

checkTruthSources();
