import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const seedFixturesRequested = process.env.STRUXIENT_SEED_FIXTURES === "true";

  if (isProduction && seedFixturesRequested) {
    console.error("❌ ERROR: Fixture seeding is strictly forbidden in production.");
    process.exit(1);
  }

  const baseDefinitionsDir = path.join(__dirname, "../src/lib/flowspec/templates/definitions");
  
  // 1. System Library Templates (isFixture: false)
  // These are real product assets and are always seeded.
  const libraryTemplates = [
    {
      file: "solar_install_basic.json",
      tradeKey: "SOLAR",
      category: "INSTALL",
      description: "Standard residential solar installation workflow from site arrival to commissioning.",
      tags: ["solar", "install", "residential"],
    },
    {
      file: "complex_correction_loops.json",
      tradeKey: "SOLAR",
      category: "FULL_CYCLE",
      description: "Realistic workflow with loopbacks and correction cycles for testing Builder UX.",
      tags: ["complex", "loops", "system-library"],
    },
    {
      file: "solar_detour_template.json",
      tradeKey: "SOLAR",
      category: "FULL_CYCLE",
      description: "Full lifecycle residential solar installation workflow demonstrating forward-only compensating detours.",
      tags: ["detour", "realistic", "solar", "system-library"],
    },
  ];

  console.log("🌱 Seeding System Library templates...");
  for (const templateInfo of libraryTemplates) {
    await seedTemplate(baseDefinitionsDir, templateInfo, false);
  }

  // 2. Fixtures (isFixture: true) - OPT-IN ONLY
  // Currently empty as previous fixtures were promoted to library assets.
  if (seedFixturesRequested) {
    const fixturesDir = path.join(baseDefinitionsDir, "fixtures");
    const fixtureTemplates: any[] = [
      // Future fixtures go here
    ];

    if (fixtureTemplates.length > 0) {
      console.log("🌱 Seeding Fixtures (Opt-in)...");
      for (const templateInfo of fixtureTemplates) {
        await seedTemplate(fixturesDir, templateInfo, true);
      }
    } else {
      console.log("⏭️ No fixtures defined to seed.");
    }
  } else {
    console.log("⏭️ Skipping fixtures (STRUXIENT_SEED_FIXTURES not enabled).");
  }
}

async function seedTemplate(
  dir: string,
  templateInfo: any,
  isFixture: boolean
) {
  const filePath = path.join(dir, templateInfo.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Template definition not found at ${filePath}, skipping.`);
    return;
  }

  const definition = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const templateKey = {
    tradeKey: templateInfo.tradeKey,
    name: definition.name,
    version: definition.version,
  };

  const template = await prisma.workflowTemplate.upsert({
    where: {
      tradeKey_name_version: templateKey,
    },
    update: {
      category: templateInfo.category,
      description: templateInfo.description,
      definition: definition as any,
      tags: templateInfo.tags,
      isFixture,
    },
    create: {
      ...templateKey,
      category: templateInfo.category,
      description: templateInfo.description,
      definition: definition as any,
      tags: templateInfo.tags,
      isFixture,
    },
  });
  console.log(`✅ Seeded ${isFixture ? "fixture" : "library"} template: ${template.name} (v${template.version})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
