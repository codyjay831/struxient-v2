import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const ALLOWED_PATHS = [
  'src/app/(app)/workstation/',
  'src/lib/flowspec/instantiation/',
  'tests/',
  'ci/guards/'
];

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const EXCLUDED_DIRS = ['docs', 'public', 'node_modules', '.git', '.next', 'dist'];

const BASE_TOKENS = ['/api/', 'flowspec', '/flows/'];
const MUTATION_INTENT = ['POST', 'start', 'outcome', 'evidence'];

/**
 * Guard: WS_MONOPOLY_01 (Execution Monopoly)
 * 
 * Rule: FlowSpec execution mutations (/start, /outcome, /evidence) are only 
 * allowed from Work Station or instantiation core.
 */
function checkMonopoly() {
  console.log('🔍 Running guard_ws_monopoly_01 (Execution Monopoly)...');
  
  let violations = 0;

  function scanDir(dir) {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const relPath = fullPath.replace(ROOT, '').replace(/\\/g, '/');
      
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (EXCLUDED_DIRS.some(d => relPath.split('/').includes(d))) continue;
        scanDir(fullPath);
      } else if (stats.isFile() && CODE_EXTENSIONS.some(ext => file.endsWith(ext))) {
        
        if (ALLOWED_PATHS.some(p => relPath.startsWith(p))) continue;

        const content = readFileSync(fullPath, 'utf-8');
        
        // Token Intersection Check
        const hasBase = BASE_TOKENS.every(t => content.includes(t));
        const hasIntent = MUTATION_INTENT.some(t => content.includes(t));

        if (hasBase && hasIntent) {
          console.error(`❌ Violation: Forbidden execution mutation pattern found in ${relPath}`);
          console.error(`   Required intersection: [${BASE_TOKENS.join(', ')}] AND [${MUTATION_INTENT.join('|')}]`);
          violations++;
        }

        // Also block direct adapter import
        if (content.includes('execution-adapter')) {
          console.error(`❌ Violation: Execution adapter imported in unauthorized file: ${relPath}`);
          violations++;
        }
      }
    }
  }

  scanDir(ROOT);

  if (violations > 0) {
    console.error(`\n❌ guard_ws_monopoly_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Work Station monopoly enforced (no unauthorized mutations).\n');
}

checkMonopoly();
