import fs from 'fs';
import path from 'path';

/**
 * CI Guard: Canvas Loopback Arrowheads
 * 
 * Verifies that loopback edges in workflow-canvas.tsx maintain:
 * 1. Perimeter anchoring (getPerimeterPoint)
 * 2. Arrowhead marker assignment (markerEnd)
 */

const CANVAS_PATH = 'src/components/canvas/workflow-canvas.tsx';

function checkGuard() {
  const content = fs.readFileSync(CANVAS_PATH, 'utf8');
  const lines = content.split('\n');
  
  let errors = [];

  // Check 1: Perimeter anchoring call inside loopback branch
  // We look for the pattern where loopback coordinates are computed
  const hasPerimeterAnchoring = content.includes('getPerimeterPoint(');
  if (!hasPerimeterAnchoring) {
    errors.push(`CRITICAL: Perimeter anchoring (getPerimeterPoint) call missing from ${CANVAS_PATH}. Arrowheads will be hidden under nodes.`);
  }

  // Check 2: markerEnd assignment for loopbacks
  // We look for the markerEnd attribute gated on isSelected/isLoopback
  const hasMarkerEnd = content.includes('markerEnd={isSelected ? "url(#arrowhead-special-selected)" : "url(#arrowhead-special)"}');
  if (!hasMarkerEnd) {
    errors.push(`CRITICAL: markerEnd attribute assignment missing or modified in ${CANVAS_PATH}. Loopback edges will lose directionality.`);
  }

  // Check 3: Visibility padding (6px)
  const hasPadding = content.includes('getPerimeterPoint(') && content.includes(', 6)');
  if (!hasPadding) {
    errors.push(`WARNING: Perimeter anchoring seems to be missing the 6px visibility padding in ${CANVAS_PATH}. Arrowheads might be partially obscured.`);
  }

  if (errors.length > 0) {
    console.error(`\n❌ [GUARD FAILURE] Canvas Loopback Arrowheads\n`);
    errors.forEach(err => console.error(`  - ${err}`));
    console.error(`\nRefer to docs/canon/flowspec/40_flowspec_builder_contract.md §5.5.9\n`);
    process.exit(1);
  }

  console.log(`\n✅ [GUARD PASS] Canvas Loopback Arrowheads enforced in ${CANVAS_PATH}\n`);
}

checkGuard();
