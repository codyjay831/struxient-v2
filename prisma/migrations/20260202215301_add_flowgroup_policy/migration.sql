-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "defaultSlaHours" INTEGER;

-- CreateTable
CREATE TABLE "FlowGroupPolicy" (
    "id" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "jobPriority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "groupDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowGroupPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPolicyOverride" (
    "id" TEXT NOT NULL,
    "flowGroupPolicyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "slaHours" INTEGER,

    CONSTRAINT "TaskPolicyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlowGroupPolicy_flowGroupId_key" ON "FlowGroupPolicy"("flowGroupId");

-- CreateIndex
CREATE INDEX "FlowGroupPolicy_flowGroupId_idx" ON "FlowGroupPolicy"("flowGroupId");

-- CreateIndex
CREATE INDEX "TaskPolicyOverride_flowGroupPolicyId_idx" ON "TaskPolicyOverride"("flowGroupPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPolicyOverride_flowGroupPolicyId_taskId_key" ON "TaskPolicyOverride"("flowGroupPolicyId", "taskId");

-- AddForeignKey
ALTER TABLE "FlowGroupPolicy" ADD CONSTRAINT "FlowGroupPolicy_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPolicyOverride" ADD CONSTRAINT "TaskPolicyOverride_flowGroupPolicyId_fkey" FOREIGN KEY ("flowGroupPolicyId") REFERENCES "FlowGroupPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
