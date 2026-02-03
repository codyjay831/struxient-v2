import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../');

const SIDEBAR_PATH = 'src/components/nav/app-sidebar.tsx';

/**
 * Guard: SHELL_BOUNDARY_01 (Logo & Sidebar Contract)
 * 
 * Rule 1: Logo must not be a navigation Link.
 * Rule 2: Collapsed sidebar must not render protrusions into content plane.
 */
function checkShellBoundary() {
  console.log('🔍 Running guard_shell_boundary_01 (Shell Boundary)...');
  
  const fullPath = join(ROOT, SIDEBAR_PATH);
  if (!existsSync(fullPath)) {
    console.error(`❌ Error: ${SIDEBAR_PATH} not found.`);
    process.exit(1);
  }

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  let violations = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Rule 1: Logo should not navigate to workstation
    if (trimmedLine.includes('<Link href="/workstation"') || trimmedLine.includes("<Link href='/workstation'")) {
      console.error(`❌ Violation [Rule 1]: Application logo must not be wrapped in a Link to /workstation.`);
      console.error(`   Line ${lineNum}: ${trimmedLine}`);
      violations++;
    }

    // Rule 2: No protrusions in collapsed state
    // Specifically look for the bad pattern: absolute + right-0 + translate-x-1/2
    // We only check this in the sidebar file as requested.
    if (trimmedLine.includes('absolute') && trimmedLine.includes('right-0') && trimmedLine.includes('translate-x-1/2')) {
      console.error(`❌ Violation [Rule 2]: Detected floating control protruding into content plane.`);
      console.error(`   Line ${lineNum}: ${trimmedLine}`);
      violations++;
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_shell_boundary_01 failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log('\n✅ Shell boundary contract maintained in app-sidebar.\n');
}

checkShellBoundary();
