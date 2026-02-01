import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const SCHEMA_PATH = join(ROOT, 'prisma/schema.prisma');

/**
 * Guard: V1_EXT_01 (ExternalParty Metadata-Only)
 * 
 * Rule: ExternalParty model MUST NOT contain auth or capability fields.
 * Purpose: Ensure ExternalParty remains metadata-only and cannot be used for execution authority in v1.
 */
function checkExternalPartyMetadataOnly() {
  console.log('🔍 Running guard_v1_ext_01 (ExternalParty Metadata-Only)...');
  
  const content = readFileSync(SCHEMA_PATH, 'utf-8');
  let violations = 0;

  // Find ExternalParty model block
  const modelMatch = content.match(/model\s+ExternalParty\s+\{([\s\S]*?)\}/i);
  if (!modelMatch) {
    console.log('Skipping: ExternalParty model not found.');
    return;
  }

  const modelContent = modelMatch[1];
  
  // Forbidden fields for metadata-only model
  const FORBIDDEN_FIELDS = [
    'userId',
    'capabilities',
    'role',
    'password',
    'clerkId',
  ];

  FORBIDDEN_FIELDS.forEach(field => {
    // Regex to match field name as a whole word in the model content
    const fieldRegex = new RegExp(`\\b${field}\\b`, 'i');
    if (fieldRegex.test(modelContent)) {
      console.error(`❌ Violation: Forbidden field "${field}" detected in ExternalParty model.`);
      violations++;
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_v1_ext_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ ExternalParty is metadata-only.\n');
}

checkExternalPartyMetadataOnly();
