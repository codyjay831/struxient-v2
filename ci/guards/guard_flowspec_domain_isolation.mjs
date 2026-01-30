import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const FLOWSPEC_LIB_PATH = join(ROOT, 'src/lib/flowspec');

const FORBIDDEN_IMPORTS = [
  '@/lib/jobs',
  '@/lib/customers',
  '../../jobs',
  '../../customers',
  '../jobs',
  '../customers',
];

/**
 * Guard: FlowSpec Domain Isolation
 * 
 * Rule: src/lib/flowspec/** MUST NOT import from src/lib/jobs/** or src/lib/customers/**
 * Purpose: FlowSpec Engine must remain domain-agnostic. Move business metadata access to Domain APIs.
 */
function checkDomainIsolation() {
  console.log('🔍 Running guard_flowspec_domain_isolation...');
  
  const files = getAllFiles(FLOWSPEC_LIB_PATH);
  let violations = 0;

  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      FORBIDDEN_IMPORTS.forEach(forbidden => {
        // Simple check for import statements
        if (line.includes('import') && line.includes(forbidden)) {
          const relativePath = file.replace(ROOT, '');
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden import detected: "${forbidden}"`);
          console.error(`   Line: ${line.trim()}`);
          violations++;
        }
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_flowspec_domain_isolation failed with ${violations} violations.`);
    console.error('“FlowSpec Engine must remain domain-agnostic. Move business metadata access to Domain APIs.”');
    process.exit(1);
  }

  console.log('\n✅ No domain isolation violations detected.\n');
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

checkDomainIsolation();
