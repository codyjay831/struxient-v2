/**
 * Guard: Tenancy Dev Provision Gate
 * 
 * Purpose: Ensure that auto-provisioning logic is strictly gated by NODE_ENV !== 'production'.
 * Canon: docs/canon/tenancy/10_tenancy_contract.md §3.2
 */

import fs from 'fs';
import path from 'path';

const TENANT_LIB = 'src/lib/auth/tenant.ts';

function checkGuard() {
  console.log('--- Guard: Tenancy Dev Provision Gate ---');
  
  if (!fs.existsSync(TENANT_LIB)) {
    console.error(`Error: ${TENANT_LIB} not found.`);
    process.exit(1);
  }

  const content = fs.readFileSync(TENANT_LIB, 'utf8');
  
  // Look for auto-provisioning logic
  const autoProvisionMatch = content.match(/Auto-provisioning company/);
  
  if (autoProvisionMatch) {
    // Ensure it is gated by NODE_ENV === "development"
    const isGated = content.includes('process.env.NODE_ENV === "development"');
    
    if (!isGated) {
      console.error(`Violation: Auto-provisioning logic found in ${TENANT_LIB} but it is NOT gated by NODE_ENV === "development".`);
      console.error('Canon Ref: 10_tenancy_contract.md §3.2');
      process.exit(1);
    }
    
    console.log('Success: Auto-provisioning logic is correctly gated.');
  } else {
    console.log('No auto-provisioning logic detected. Guard passed.');
  }
}

checkGuard();
