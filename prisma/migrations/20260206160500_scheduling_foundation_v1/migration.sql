-- CreateEnum
CREATE TYPE "ScheduleTimeClass" AS ENUM ('COMMITTED', 'PLANNED', 'REQUESTED', 'SUGGESTED');

-- CreateTable
CREATE TABLE "ScheduleChangeRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flowId" TEXT,
    "taskId" TEXT,
    "detourRecordId" TEXT,
    "timeClass" "ScheduleTimeClass" NOT NULL DEFAULT 'PLANNED',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "ScheduleChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "flowId" TEXT,
    "taskId" TEXT,
    "resourceId" TEXT,
    "resourceType" TEXT,
    "timeClass" "ScheduleTimeClass" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "supersededBy" TEXT,
    "changeRequestId" TEXT,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_companyId_status_idx" ON "ScheduleChangeRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_flowId_idx" ON "ScheduleChangeRequest"("flowId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_companyId_timeClass_supersededAt_idx" ON "ScheduleBlock"("companyId", "timeClass", "supersededAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_startAt_endAt_idx" ON "ScheduleBlock"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_resourceId_supersededAt_idx" ON "ScheduleBlock"("resourceId", "supersededAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_jobId_idx" ON "ScheduleBlock"("jobId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_flowId_taskId_idx" ON "ScheduleBlock"("flowId", "taskId");

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_detourRecordId_fkey" FOREIGN KEY ("detourRecordId") REFERENCES "DetourRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ScheduleChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
