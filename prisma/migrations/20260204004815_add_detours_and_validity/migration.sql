-- CreateEnum
CREATE TYPE "DetourStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "DetourType" AS ENUM ('NON_BLOCKING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "ValidityState" AS ENUM ('VALID', 'PROVISIONAL', 'INVALID');

-- AlterTable
ALTER TABLE "TaskExecution" ADD COLUMN     "resolvedDetourId" TEXT;

-- CreateTable
CREATE TABLE "DetourRecord" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "checkpointNodeId" TEXT NOT NULL,
    "checkpointTaskExecutionId" TEXT,
    "resumeTargetNodeId" TEXT NOT NULL,
    "type" "DetourType" NOT NULL DEFAULT 'NON_BLOCKING',
    "status" "DetourStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "repeatIndex" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedBy" TEXT NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "escalatedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedBy" TEXT,

    CONSTRAINT "DetourRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidityEvent" (
    "id" TEXT NOT NULL,
    "taskExecutionId" TEXT NOT NULL,
    "state" "ValidityState" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ValidityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetourRecord_flowId_status_idx" ON "DetourRecord"("flowId", "status");

-- CreateIndex
CREATE INDEX "DetourRecord_flowId_checkpointNodeId_idx" ON "DetourRecord"("flowId", "checkpointNodeId");

-- CreateIndex
CREATE INDEX "ValidityEvent_taskExecutionId_createdAt_idx" ON "ValidityEvent"("taskExecutionId", "createdAt");

-- AddForeignKey
ALTER TABLE "DetourRecord" ADD CONSTRAINT "DetourRecord_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetourRecord" ADD CONSTRAINT "DetourRecord_checkpointTaskExecutionId_fkey" FOREIGN KEY ("checkpointTaskExecutionId") REFERENCES "TaskExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidityEvent" ADD CONSTRAINT "ValidityEvent_taskExecutionId_fkey" FOREIGN KEY ("taskExecutionId") REFERENCES "TaskExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
