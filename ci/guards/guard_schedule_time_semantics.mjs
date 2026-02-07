import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GUARDED_SCHEDULE_MODELS } from './scheduling_boundary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const SCHEMA_PATH = join(ROOT, 'prisma/schema.prisma');

/**
 * Guard: Schedule Time Semantics
 * 
 * Enforces: Right Time Semantics
 * Rule: Every schedule block must have an explicit timeClass.
 */
function checkTimeSemantics() {
  console.log('🔍 Running guard_schedule_time_semantics...');
  
  const content = readFileSync(SCHEMA_PATH, 'utf-8');
  const models = content.split('model ').slice(1);
  let violations = 0;

  models.forEach(modelBlock => {
    const modelName = modelBlock.split('{')[0].trim();
    
    // Rule: Match only canon schedule model names (exact match)
    if (GUARDED_SCHEDULE_MODELS.includes(modelName)) {
       if (!modelBlock.includes('timeClass')) {
         console.error(`❌ Violation in prisma/schema.prisma`);
         console.error(`   Canon model "${modelName}" detected but missing "timeClass" field.`);
         console.error(`   Rule: Every schedule block must explicitly declare its class.`);
         violations++;
       }
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_schedule_time_semantics failed.`);
    process.exit(1);
  }

  console.log('\n✅ Schedule time semantics enforcement active (canon models only).\n');
}

checkTimeSemantics();
