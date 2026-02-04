import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const definitionsDir = path.join(__dirname, "../src/lib/flowspec/templates/definitions");
  
  const templatesToSeed = [
    {
      file: "solar_install_basic.json",
      tradeKey: "SOLAR",
      category: "INSTALL",
      description: "Standard residential solar installation workflow from site arrival to commissioning.",
      tags: ["real demo"],
    },
    {
      file: "complex_correction_loops.json",
      tradeKey: "SOLAR",
      category: "FULL_CYCLE",
      description: "Realistic workflow with loopbacks and correction cycles for testing Builder UX.",
      tags: ["complex", "loops", "demo"],
    },
    {
      file: "solar_detour_template.json",
      tradeKey: "SOLAR",
      category: "FULL_CYCLE",
      description: "Full lifecycle residential solar installation workflow demonstrating forward-only compensating detours.",
      tags: ["detour", "realistic", "solar"],
    },
  ];

  for (const templateInfo of templatesToSeed) {
    const filePath = path.join(definitionsDir, templateInfo.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Template definition not found at ${filePath}, skipping.`);
      continue;
    }

    const definition = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const templateKey = {
      tradeKey: templateInfo.tradeKey,
      name: definition.name,
      version: definition.version,
    };

    // B.1.7: Non-destructive seeding for templates (updated to upsert)
    const template = await prisma.workflowTemplate.upsert({
      where: {
        tradeKey_name_version: templateKey,
      },
      update: {
        category: templateInfo.category,
        description: templateInfo.description,
        definition: definition as any,
        tags: templateInfo.tags,
      },
      create: {
        ...templateKey,
        category: templateInfo.category,
        description: templateInfo.description,
        definition: definition as any,
        tags: templateInfo.tags,
      },
    });
    console.log(`Seeded template: ${template.name} (ID: ${template.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
