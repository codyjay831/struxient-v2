import { prisma } from "./src/lib/prisma";
import { WorkflowStatus } from "@prisma/client";

async function reproduce() {
  const company = await prisma.company.create({
    data: { name: "Test Company" },
  });

  const workflow = await prisma.workflow.create({
    data: {
      name: "Test Workflow",
      companyId: company.id,
      status: WorkflowStatus.DRAFT,
    },
  });

  console.log(`Created workflow: ${workflow.id}`);
  
  // Now hit the endpoint. We can't easily do this from a script because of Clerk auth.
  // But we can check the route handler code for logic errors.
}

reproduce();
