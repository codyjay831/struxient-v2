import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseTemplateDefinition } from "../../src/lib/flowspec/templates/schema";

describe("Template Schema Compliance", () => {
  const definitionsDir = path.resolve(__dirname, "../../src/lib/flowspec/templates/definitions");
  
  if (!fs.existsSync(definitionsDir)) {
    it.skip("no definitions found", () => {});
    return;
  }

  const files = fs.readdirSync(definitionsDir).filter(f => f.endsWith(".json"));

  it.each(files)("template %s should satisfy the canonical Zod schema", (filename) => {
    const filePath = path.join(definitionsDir, filename);
    const content = fs.readFileSync(filePath, "utf-8");
    const definition = JSON.parse(content);

    // This calls the same logic used in the import service (parseTemplateDefinition)
    // which includes both Zod validation and structural invariant checks.
    expect(() => parseTemplateDefinition(definition)).not.toThrow();
  });
});
