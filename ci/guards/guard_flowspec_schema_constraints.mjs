#!/usr/bin/env node
/**
 * guard_flowspec_schema_constraints.mjs
 * 
 * CI Guard: Enforce Truth immutability and forbid derived-state-as-truth in Prisma schema.
 * 
 * Canon Source: implementation_plan.md §10.6
 * Milestone: M0 (must pass before EPIC-01 code)
 * 
 * Constraints Enforced:
 * | Constraint | Tables Affected | Invariant Protected |
 * |------------|-----------------|---------------------|
 * | No `@updatedAt` on Truth tables | TaskExecution, NodeActivation, EvidenceAttachment | INV-007 (Outcome Immutability) |
 * | No `onDelete: Cascade` on Truth FKs | TaskExecution, NodeActivation, EvidenceAttachment | Audit trail preservation |
 * | `FlowStatus` includes `BLOCKED` | Flow | INV-023 (Fan-Out Failure Behavior) |
 * | No `targetVersion` on FanOutRule | FanOutRule | §10.3.1 (No version pinning in v2) |
 * | No `retriedAt`/`retryCount` on FanOutFailure | FanOutFailure | §10.3.2 (No retry in v2) |
 * | No `actionable` column on Task models | Task, TaskExecution | INV-006 (Derived State not stored) |
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '../../prisma/schema.prisma');

// Truth tables that must NOT have @updatedAt
const TRUTH_TABLES = ['TaskExecution', 'NodeActivation', 'EvidenceAttachment'];

// Tables that must not have onDelete: Cascade on their flow FK
const TRUTH_TABLES_NO_CASCADE = ['TaskExecution', 'NodeActivation', 'EvidenceAttachment'];

// Columns forbidden on specific tables (derived state must not be stored)
const FORBIDDEN_COLUMNS = {
  Task: ['actionable'],
  TaskExecution: ['actionable'],
  FanOutRule: ['targetVersion', 'targetVersionId'],
  FanOutFailure: ['retriedAt', 'retryCount'],
};

// Required enum values
const REQUIRED_ENUM_VALUES = {
  FlowStatus: ['BLOCKED'],
};

class SchemaConstraintGuard {
  constructor(schemaContent) {
    this.schemaContent = schemaContent;
    this.violations = [];
  }

  parseModel(modelName) {
    const regex = new RegExp(`model\\s+${modelName}\\s*\\{([^}]+)\\}`, 's');
    const match = this.schemaContent.match(regex);
    return match ? match[1] : null;
  }

  parseEnum(enumName) {
    const regex = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]+)\\}`, 's');
    const match = this.schemaContent.match(regex);
    return match ? match[1] : null;
  }

  checkNoUpdatedAtOnTruthTables() {
    for (const tableName of TRUTH_TABLES) {
      const modelContent = this.parseModel(tableName);
      if (!modelContent) {
        // Table doesn't exist yet - skip (will be created in migration)
        continue;
      }

      if (modelContent.includes('@updatedAt')) {
        this.violations.push({
          constraint: 'NO_UPDATED_AT_ON_TRUTH',
          table: tableName,
          invariant: 'INV-007',
          message: `Truth table "${tableName}" has @updatedAt which violates Outcome Immutability (INV-007). Truth tables must be append-only.`,
        });
      }
    }
  }

  checkNoCascadeOnTruthFKs() {
    for (const tableName of TRUTH_TABLES_NO_CASCADE) {
      const modelContent = this.parseModel(tableName);
      if (!modelContent) {
        continue;
      }

      // Check for onDelete: Cascade in relation fields
      if (modelContent.includes('onDelete: Cascade')) {
        this.violations.push({
          constraint: 'NO_CASCADE_ON_TRUTH_FK',
          table: tableName,
          invariant: 'AUDIT_TRAIL',
          message: `Truth table "${tableName}" has onDelete: Cascade which violates audit trail preservation. Truth records must be preserved for audit.`,
        });
      }
    }
  }

  checkRequiredEnumValues() {
    for (const [enumName, requiredValues] of Object.entries(REQUIRED_ENUM_VALUES)) {
      const enumContent = this.parseEnum(enumName);
      if (!enumContent) {
        // Enum doesn't exist yet - skip
        continue;
      }

      for (const requiredValue of requiredValues) {
        if (!enumContent.includes(requiredValue)) {
          this.violations.push({
            constraint: 'REQUIRED_ENUM_VALUE',
            enum: enumName,
            value: requiredValue,
            invariant: 'INV-023',
            message: `Enum "${enumName}" is missing required value "${requiredValue}" (required by INV-023 Fan-Out Failure Behavior).`,
          });
        }
      }
    }
  }

  checkForbiddenColumns() {
    for (const [tableName, forbiddenCols] of Object.entries(FORBIDDEN_COLUMNS)) {
      const modelContent = this.parseModel(tableName);
      if (!modelContent) {
        continue;
      }

      for (const col of forbiddenCols) {
        // Check for column definition (word boundary to avoid false positives)
        const colRegex = new RegExp(`\\b${col}\\b\\s+\\w+`, 'i');
        if (colRegex.test(modelContent)) {
          this.violations.push({
            constraint: 'FORBIDDEN_COLUMN',
            table: tableName,
            column: col,
            invariant: 'INV-006',
            message: `Table "${tableName}" has forbidden column "${col}". Derived state must NOT be stored as Truth (INV-006).`,
          });
        }
      }
    }
  }

  run() {
    console.log('🔍 Running guard_flowspec_schema_constraints...\n');

    this.checkNoUpdatedAtOnTruthTables();
    this.checkNoCascadeOnTruthFKs();
    this.checkRequiredEnumValues();
    this.checkForbiddenColumns();

    if (this.violations.length === 0) {
      console.log('✅ All schema constraints satisfied.\n');
      return 0;
    }

    console.log(`❌ ${this.violations.length} schema constraint violation(s) found:\n`);
    for (const v of this.violations) {
      console.log(`  [${v.constraint}] ${v.message}`);
      console.log(`    Invariant: ${v.invariant}`);
      console.log('');
    }

    console.log('Fix these violations before proceeding.');
    console.log('If a constraint is wrong, update canon first (see implementation_plan.md §10.5).\n');
    return 1;
  }
}

// Main execution
try {
  const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');
  const guard = new SchemaConstraintGuard(schemaContent);
  const exitCode = guard.run();
  process.exit(exitCode);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('⚠️  Prisma schema not found at:', SCHEMA_PATH);
    console.log('   Guard will pass (schema will be created).\n');
    process.exit(0);
  }
  console.error('❌ Error reading schema:', error.message);
  process.exit(1);
}
