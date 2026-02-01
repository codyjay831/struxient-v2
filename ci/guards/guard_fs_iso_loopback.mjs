import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../");
const FLOWSPEC_LIB_PATH = join(ROOT, "src/lib/flowspec");

const FORBIDDEN_IMPORTS = [
  "@/lib/builder",
  "../builder",
  "../../builder",
  "../../../builder",
];

/**
 * Guard: FS_ISO_LOOPBACK (FlowSpec Loopback Isolation)
 *
 * Rule: src/lib/flowspec/** MUST NOT import from the Builder domain (especially loopback detection).
 * Purpose: Ensure loopback logic remains a UX-only derived property and does not bleed into the core engine.
 */
function checkFlowSpecLoopbackIsolation() {
  console.log("🔍 Running guard_fs_iso_loopback (FlowSpec Loopback Isolation)...");

  const files = getAllFiles(FLOWSPEC_LIB_PATH);
  let violations = 0;

  files.forEach((file) => {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) return;

    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      FORBIDDEN_IMPORTS.forEach((forbidden) => {
        if (line.includes("import") && line.includes(forbidden)) {
          const relativePath = file.replace(ROOT, "");
          console.error(`❌ Violation in ${relativePath}:${index + 1}`);
          console.error(`   Forbidden import detected: "${forbidden}"`);
          console.error(`   Line: ${line.trim()}`);
          violations++;
        }
      });
    });
  });

  if (violations > 0) {
    console.error(`\n❌ guard_fs_iso_loopback failed with ${violations} violations.`);
    process.exit(1);
  }

  console.log("\n✅ No FlowSpec loopback isolation violations detected.\n");
}

function getAllFiles(dirPath, arrayOfFiles) {
  const files = readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const fullPath = join(dirPath, "/", file);
    if (statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

checkFlowSpecLoopbackIsolation();
