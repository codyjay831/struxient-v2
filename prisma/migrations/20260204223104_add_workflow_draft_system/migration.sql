-- CreateEnum
CREATE TYPE "DraftEventType" AS ENUM ('INITIAL', 'COMMIT', 'RESTORE');

-- CreateTable
CREATE TABLE "WorkflowDraftBuffer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "baseEventId" TEXT,

    CONSTRAINT "WorkflowDraftBuffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDraftEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "DraftEventType" NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "restoresEventId" TEXT,

    CONSTRAINT "WorkflowDraftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDraftBuffer_workflowId_key" ON "WorkflowDraftBuffer"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowDraftBuffer_companyId_workflowId_idx" ON "WorkflowDraftBuffer"("companyId", "workflowId");

-- CreateIndex
CREATE INDEX "WorkflowDraftEvent_companyId_workflowId_idx" ON "WorkflowDraftEvent"("companyId", "workflowId");

-- CreateIndex
CREATE INDEX "WorkflowDraftEvent_workflowId_createdAt_idx" ON "WorkflowDraftEvent"("workflowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDraftEvent_workflowId_seq_key" ON "WorkflowDraftEvent"("workflowId", "seq");

-- AddForeignKey
ALTER TABLE "WorkflowDraftBuffer" ADD CONSTRAINT "WorkflowDraftBuffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraftBuffer" ADD CONSTRAINT "WorkflowDraftBuffer_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraftBuffer" ADD CONSTRAINT "WorkflowDraftBuffer_baseEventId_fkey" FOREIGN KEY ("baseEventId") REFERENCES "WorkflowDraftEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraftEvent" ADD CONSTRAINT "WorkflowDraftEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraftEvent" ADD CONSTRAINT "WorkflowDraftEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraftEvent" ADD CONSTRAINT "WorkflowDraftEvent_restoresEventId_fkey" FOREIGN KEY ("restoresEventId") REFERENCES "WorkflowDraftEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
