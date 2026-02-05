import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const TARGET_DIRS = ['src/app/(app)/(fullbleed)/workstation'];

const ALLOWED_ROOTS = [
  '/api/flowspec/',
  '/api/tenancy/me',
  '/api/tenancy/vault/',
  '/api/jobs/',
];

const FORBIDDEN_DOMAINS = [
  'finance',
  'scheduling',
  'sales',
  'admin',
  'responsibility'
];

const INTENT_TOKENS = ['fetch', 'axios', 'ky', 'method:', 'GET', 'POST'];

/**
 * Guard: WS_SIDE_EFFECTS_01 (Side Effect Allowlist)
 * 
 * Rule: Work Station is restricted to an allowlist of API roots.
 * Prevents direct calls to mutative domains (Finance, Sales, etc).
 */
function checkSideEffects() {
  console.log('🔍 Running guard_ws_side_effects_01 (Side Effect Allowlist)...');
  
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
        
        // Scenario A: Forbidden Domain Intersection (Destination-based)
        FORBIDDEN_DOMAINS.forEach(domain => {
          // Look for the domain token appearing within an /api/ string literal
          const regex = new RegExp(`['"\\\`]\\/api\\/.*\\b${domain}\\b.*['"\\\`]`, 'i');
          if (regex.test(content)) {
            console.error(`❌ Violation: Forbidden API destination containing "${domain}" detected in ${relPath}.`);
            violations++;
          }
        });

        // Scenario B: Unknown API Destination (Intent-aware)
        // Rule: "/api/" + intent + another segment + NOT allowlisted
        if (content.includes('/api/')) {
          const hasIntent = INTENT_TOKENS.some(t => content.includes(t));
          const hasPathToken = /\/api\/[^"'\s]+\//.test(content);
          const hasAllowlisted = ALLOWED_ROOTS.some(root => content.includes(root));

          if (hasIntent && hasPathToken && !hasAllowlisted) {
            // Find what triggered the unknown path token for error logging
            const match = content.match(/\/api\/[^"'\s]+\//);
            console.error(`❌ Violation: Unauthorized or unknown API path pattern "${match?.[0]}" in ${relPath}.`);
            violations++;
          }
        }
      }
    }
  }

  TARGET_DIRS.forEach(dir => scanDir(join(ROOT, dir)));

  if (violations > 0) {
    console.error(`\n❌ guard_ws_side_effects_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Work Station side-effects are restricted to allowlist.\n');
}

checkSideEffects();
