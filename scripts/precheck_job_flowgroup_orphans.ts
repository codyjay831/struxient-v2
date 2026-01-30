import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking for orphan Job records (Jobs without a FlowGroup)...");

  // Efficient check using NOT EXISTS style or finding IDs not in the FlowGroup table
  const orphans = await prisma.job.findMany({
    where: {
      NOT: {
        flowGroupId: {
          in: (await prisma.flowGroup.findMany({ select: { id: true } })).map(fg => fg.id)
        }
      }
    },
    select: {
      id: true,
      flowGroupId: true,
      companyId: true
    }
  });

  if (orphans.length > 0) {
    console.error(`❌ Found ${orphans.length} orphan Job records!`);
    console.table(orphans.slice(0, 10)); // Show sample
    process.exit(1);
  }

  console.log("✅ No orphan Job records found. Safe to migrate.");
  process.exit(0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
