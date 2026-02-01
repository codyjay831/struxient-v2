import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../");
const PRISMA_SCHEMA_PATH = join(ROOT, "prisma/schema.prisma");
const FLOWSPEC_TYPES_PATH = join(ROOT, "src/lib/flowspec/types.ts");

const FORBIDDEN_KEYWORDS = ["isLoopback", "loopbackLabel", "loopbackName"];

/**
 * Guard: SCHEMA_PURITY (FlowSpec Schema Purity)
 *
 * Rule: Prisma schema and core FlowSpec types MUST NOT contain loopback-related fields.
 * Purpose: Ensure loopback metadata remains UI-only and is not persisted in the engine or database.
 */
function checkSchemaPurity() {
  console.log("🔍 Running guard_schema_purity (Schema Purity)...");

  let violations = 0;

  [PRISMA_SCHEMA_PATH, FLOWSPEC_TYPES_PATH].forEach((filePath) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        FORBIDDEN_KEYWORDS.forEach((keyword) => {
          // Check for keyword as a property/field (not in comments or imports)
          // Simple heuristic: keyword followed by colon or space, and not in a comment
          const trimmed = line.trim();
          if (
            trimmed.includes(keyword) &&
            !trimmed.startsWith("//") &&
            !trimmed.startsWith("*") &&
            !trimmed.includes("import")
          ) {
            const relativePath = filePath.replace(ROOT, "");
            console.error(`❌ Violation in ${relativePath}:${index + 1}`);
            console.error(`   Forbidden keyword detected: "${keyword}"`);
            console.error(`   Line: ${line.trim()}`);
            violations++;
          }
        });
      });
    } catch (e) {
      console.warn(`⚠️ Warning: Could not read ${filePath}`);
    }
  });

  if (violations > 0) {
    console.error(`\n❌ guard_schema_purity failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log("\n✅ No schema purity violations detected.\n");
}

checkSchemaPurity();
