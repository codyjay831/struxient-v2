import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const SCHEMA_PATH = join(ROOT, 'prisma/schema.prisma');

/**
 * Guard: V1_GRP_01 (No Groups in v1)
 * 
 * Rule: Prisma schema MUST NOT contain a "Group" model or "GROUP" assigneeType in v1.
 * Purpose: Enforce Phase 1 scope lock and prevent premature Group implementation.
 */
function checkNoGroups() {
  console.log('🔍 Running guard_v1_grp_01 (No Groups in v1)...');
  
  const content = readFileSync(SCHEMA_PATH, 'utf-8');
  let violations = 0;

  // Check for Group model (exact match)
  if (/\bmodel\s+Group\b/i.test(content)) {
    console.error('❌ Violation: "Group" model detected in schema.prisma');
    violations++;
  }

  // Check for GROUP in AssigneeType enum (exact match within block)
  const enumMatch = content.match(/enum\s+AssigneeType\s+\{([\s\S]*?)\}/i);
  if (enumMatch && /\bGROUP\b/.test(enumMatch[1])) {
    console.error('❌ Violation: "GROUP" assigneeType detected in AssigneeType enum');
    violations++;
  }

  if (violations > 0) {
    console.error(`\n❌ guard_v1_grp_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No Group implementation detected in schema.\n');
}

checkNoGroups();
