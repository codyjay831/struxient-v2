import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const definitionsDir = path.join(__dirname, "../src/lib/flowspec/templates/definitions");
  const solarInstallPath = path.join(definitionsDir, "solar_install_basic.json");
  
  if (!fs.existsSync(solarInstallPath)) {
    throw new Error(`Template definition not found at ${solarInstallPath}`);
  }

  const definition = JSON.parse(fs.readFileSync(solarInstallPath, "utf-8"));

  const templateKey = {
    tradeKey: "SOLAR",
    name: "Solar Install - Basic",
    version: 1,
  };

  // B.1.7: Non-destructive seeding for templates
  // Check existence first; if exists, do NOT update.
  const existingTemplate = await prisma.workflowTemplate.findUnique({
    where: {
      tradeKey_name_version: templateKey,
    },
  });

  if (!existingTemplate) {
    const template = await prisma.workflowTemplate.create({
      data: {
        ...templateKey,
        category: "INSTALL",
        description: "Standard residential solar installation workflow from site arrival to commissioning.",
        definition: definition as any,
        tags: ["real demo"],
      },
    });
    console.log(`Created template: ${template.name} (ID: ${template.id})`);
  } else {
    console.log(`Template already exists, skipping update: ${existingTemplate.name} (ID: ${existingTemplate.id})`);
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
