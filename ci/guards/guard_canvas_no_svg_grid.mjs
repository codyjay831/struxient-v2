/**
 * Guard: No SVG Grids
 * 
 * Prevents the reintroduction of SVG-based grid rendering in the FlowSpec Builder.
 * Enforces Canvas Interaction Law 6.A (Screen-Space vs World-Space Responsibility).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../');
const TARGET_FILE = path.join(ROOT, 'src/components/canvas/workflow-canvas.tsx');

const FORBIDDEN_PATTERNS = [
  { pattern: '<pattern', description: 'SVG <pattern> tags' },
  { pattern: 'id="grid"', description: 'Grid ID definitions' },
  { pattern: 'url(#grid)', description: 'Grid URL references' },
  { pattern: 'fill="url(#grid)"', description: 'SVG fill using grid patterns' },
  { pattern: 'patternUnits="userSpaceOnUse"', description: 'Grid pattern scaling attributes' }
];

console.log(`🔍 Running guard_canvas_no_svg_grid...`);

if (!fs.existsSync(TARGET_FILE)) {
  console.log(`Skipping: ${TARGET_FILE} not found.`);
  process.exit(0);
}

const content = fs.readFileSync(TARGET_FILE, 'utf8');
const lines = content.split('\n');
let violations = 0;

FORBIDDEN_PATTERNS.forEach(({ pattern, description }) => {
  lines.forEach((line, index) => {
    if (line.includes(pattern)) {
      console.error(`❌ VIOLATION: ${description} found in ${TARGET_FILE}:${index + 1}`);
      console.error(`   Line: ${line.trim()}`);
      violations++;
    }
  });
});

if (violations > 0) {
  console.error(`\nFound ${violations} violations of Canvas Interaction Laws.`);
  console.error(`Refer to docs/canon/ux/flowspec_canvas_ux_law_v1_2.md for rendering rules.`);
  process.exit(1);
}

console.log(`✅ No SVG grids detected.`);
process.exit(0);
