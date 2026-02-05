import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

/**
 * Guard: WS_LEGACY_ROUTES
 * 
 * Rule: No Work Station routes allowed outside of (fullbleed).
 * This prevents re-introduction of legacy (main) workstation routes.
 */
function checkLegacyRoutes() {
  console.log('🔍 Running guard_ws_legacy_routes...');

  const forbiddenPaths = [
    'src/app/(app)/(main)/workstation',
    'src/app/(app)/workstation',
    'src/app/dashboard'
  ];

  let violations = 0;

  for (const path of forbiddenPaths) {
    const fullPath = join(ROOT, path);
    if (existsSync(fullPath)) {
      console.error(`❌ Violation: Legacy workstation path reintroduced: ${path}`);
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n❌ guard_ws_legacy_routes failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ No legacy workstation routes found.\n');
}

checkLegacyRoutes();
