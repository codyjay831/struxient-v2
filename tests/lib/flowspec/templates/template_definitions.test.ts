import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseTemplateDefinition } from "@/lib/flowspec/templates/schema";

describe("Workflow Template Definitions Validation", () => {
  const definitionsDir = path.join(process.cwd(), "src/lib/flowspec/templates/definitions");
  const definitionFiles = fs.readdirSync(definitionsDir).filter(f => f.endsWith(".json"));

  it("should find at least one template definition", () => {
    expect(definitionFiles.length).toBeGreaterThan(0);
  });

  definitionFiles.forEach(file => {
    it(`should validate ${file} against the WorkflowSnapshot schema`, () => {
      const filePath = path.join(definitionsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const definition = JSON.parse(content);

      expect(() => parseTemplateDefinition(definition)).not.toThrow();
    });
  });
});
