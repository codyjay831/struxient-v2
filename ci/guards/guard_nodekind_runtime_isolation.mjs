import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const FLOWSPEC_RUNTIME_PATH = join(ROOT, 'src/lib/flowspec');

const FORBIDDEN_TOKENS = [
  'nodeKind',
  '.nodeKind'
];

const EXCLUDED_FILES = [
  'types.ts',
  'lifecycle/versioning.ts',
  'persistence/workflow.ts'
];

/**
 * Guard: NodeKind Runtime Isolation
 * 
 * Rule: FlowSpec Engine Runtime (engine.ts, derived.ts, etc.) MUST NOT access nodeKind.
 * Purpose: Ensure visual classification does not bleed into execution semantics.
 */
function checkNodeKindIsolation() {
  console.log('🔍 Running guard_nodekind_runtime_isolation...');
  
  const files = getAllFiles(FLOWSPEC_RUNTIME_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts')) return;
    
    const relativePath = file.replace(ROOT, '').replace(/\\/g, '/');
    if (EXCLUDED_FILES.some(excluded => relativePath.endsWith(excluded))) return;

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Ignore comments
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;

      FORBIDDEN_TOKENS.forEach(token => {
        if (line.includes(token)) {
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden access to "nodeKind" detected.`);
          console.error(`   Line: ${line.trim()}`);
          violations++;
        }
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_nodekind_runtime_isolation failed with ${violations} violations.`);
    console.error('“nodeKind is for UI/Styling only and MUST NOT influence engine execution logic.”');
    process.exit(1);
  }

  console.log('\n✅ No nodeKind runtime isolation violations detected.\n');
}

function getAllFiles(dirPath, arrayOfFiles) {
  const files = readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

checkNodeKindIsolation();
