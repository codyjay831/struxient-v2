import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');
const TARGET_FILE = 'src/app/(app)/(fullbleed)/workstation/_components/task-execution-content.tsx';

const FORBIDDEN_IMPORTS = [
  'JobHeader',
  'next/navigation',
  'ArrowLeft',
  'lucide-react' // We allow some lucide-react, but let's check for specific ones if needed.
];

const FORBIDDEN_SPECIFIC = [
  'JobHeader',
  'useRouter',
  'useSearchParams',
  'ArrowLeft'
];

/**
 * Guard: guard_ws_taskexecution_content_only
 * 
 * Rule: TaskExecutionContent must be a pure content component.
 * It must NOT render shell elements like back buttons or JobHeader.
 * It must NOT handle its own navigation/URL state.
 */
function checkTaskExecutionContent() {
  console.log('🔍 Running guard_ws_taskexecution_content_only...');
  
  const fullPath = join(ROOT, TARGET_FILE);
  if (!existsSync(fullPath)) {
    console.log('✅ Target file does not exist (skipping).');
    return;
  }

  const content = readFileSync(fullPath, 'utf-8');
  let violations = 0;

  FORBIDDEN_SPECIFIC.forEach(token => {
    // Check for imports or usage
    const importRegex = new RegExp(`import.*${token}.*from`, 'g');
    if (importRegex.test(content) || content.includes(`<${token}`)) {
      console.error(`❌ Violation: Forbidden element/import "${token}" detected in ${TARGET_FILE}.`);
      violations++;
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_ws_taskexecution_content_only failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ TaskExecutionContent is content-pure.\n');
}

checkTaskExecutionContent();
