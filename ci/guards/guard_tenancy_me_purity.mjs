import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const ME_ROUTE_PATH = join(ROOT, 'src/app/api/tenancy/me/route.ts');

const FORBIDDEN_TOKENS = [
  'capability',
  'capabilities',
  'role',
  'assignments',
  'ExternalParty',
  'JobAssignment',
  'userId',
];

/**
 * Guard: Tenancy Me Purity
 * 
 * Rule: /api/tenancy/me MUST ONLY return memberId and companyId.
 * Purpose: Prevent identity drift where Responsibility data starts leaking auth/capability context.
 */
function checkMeEndpointPurity() {
  console.log('🔍 Running guard_tenancy_me_purity...');
  
  const content = readFileSync(ME_ROUTE_PATH, 'utf-8');
  let violations = 0;

  FORBIDDEN_TOKENS.forEach(token => {
    // Check if token is being returned in apiSuccess (within the object literal)
    const regex = new RegExp(`apiSuccess\\s*\\(\\s*\\{[\\s\\S]*?\\b${token}\\b`, 'i');
    if (regex.test(content)) {
      console.error(`❌ Violation: Forbidden token "${token}" detected in /api/tenancy/me response object.`);
      violations++;
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_tenancy_me_purity failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ /api/tenancy/me response is pure.\n');
}

checkMeEndpointPurity();
