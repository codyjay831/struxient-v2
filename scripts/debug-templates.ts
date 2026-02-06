import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
  console.log("--- DEBUG: WorkflowTemplate isFixture State ---");
  const templates = await prisma.workflowTemplate.findMany({
    select: {
      id: true,
      name: true,
      tradeKey: true,
      version: true,
      isFixture: true
    },
    orderBy: { name: 'asc' }
  });

  console.table(templates);
  
  const fixtureCount = await prisma.workflowTemplate.count({ where: { isFixture: true } });
  const libraryCount = await prisma.workflowTemplate.count({ where: { isFixture: false } });
  
  console.log(`Summary: Library=${libraryCount}, Fixtures=${fixtureCount}`);
  process.exit(0);
}

debug().catch(console.error);
