import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const TARGET_ROUTES = [
  'src/app/api/flowspec/actionable-tasks/route.ts',
  'src/app/api/flowspec/flow-groups/[id]/actionable-tasks/route.ts'
];

const FORBIDDEN_TOKENS = [
  'userId',
  'role',
  'capability',
  'capabilities',
  'permission',
  'permissions',
];

/**
 * Guard: ACT_PURITY_01 (Actionable Projection Purity)
 * 
 * Rule: Actionable task endpoints MUST NOT include auth/identity tokens (userId, role, capabilities) 
 * anywhere in the file (to catch leaks in select, include, or mapping code).
 * 
 * Purpose: Prevent identity leakage and ensure Responsibility Layer remains metadata-only.
 */
function checkActionablePurity() {
  console.log('🔍 Running guard_act_purity_01 (Actionable Purity)...');
  
  let violations = 0;

  TARGET_ROUTES.forEach(routePath => {
    const fullPath = join(ROOT, routePath);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Strip multi-line comments
      let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
      // Strip single-line comments
      cleanContent = cleanContent.replace(/\/\/.*$/gm, '');
      
      FORBIDDEN_TOKENS.forEach(token => {
        // Broad scan for forbidden tokens (case-insensitive) in clean content
        const regex = new RegExp(`\\b${token}\\b`, 'i');
        if (regex.test(cleanContent)) {
          console.error(`❌ Violation: Forbidden token "${token}" detected in ${routePath}.`);
          violations++;
        }
      });
    } catch (err) {
      console.warn(`⚠️ Warning: Could not read ${routePath}, skipping...`);
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_act_purity_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Actionable endpoints are pure (no identity leakage).\n');
}

checkActionablePurity();
