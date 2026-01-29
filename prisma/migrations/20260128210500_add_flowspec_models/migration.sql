-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'WORKER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CompletionRule" AS ENUM ('ALL_TASKS_DONE', 'ANY_TASK_DONE', 'SPECIFIC_TASKS_DONE');

-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FILE', 'TEXT', 'STRUCTURED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'WORKER',
    "capabilities" JSONB NOT NULL DEFAULT '{"allow":[],"deny":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isNonTerminating" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEntry" BOOLEAN NOT NULL DEFAULT false,
    "completionRule" "CompletionRule" NOT NULL DEFAULT 'ALL_TASKS_DONE',
    "specificTasks" TEXT[],
    "position" JSONB,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSchema" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "outcomeName" TEXT NOT NULL,
    "targetNodeId" TEXT,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossFlowDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sourceWorkflowId" TEXT NOT NULL,
    "sourceTaskPath" TEXT NOT NULL,
    "requiredOutcome" TEXT NOT NULL,

    CONSTRAINT "CrossFlowDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanOutRule" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "triggerOutcome" TEXT NOT NULL,
    "targetWorkflowId" TEXT NOT NULL,

    CONSTRAINT "FanOutRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowGroup" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "status" "FlowStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeActivation" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iteration" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NodeActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecution" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "nodeActivationId" TEXT,
    "startedAt" TIMESTAMP(3),
    "startedBy" TEXT,
    "outcome" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "outcomeBy" TEXT,
    "iteration" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAttachment" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskExecutionId" TEXT,
    "type" "EvidenceType" NOT NULL,
    "data" JSONB NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedBy" TEXT NOT NULL,
    "idempotencyKey" TEXT,

    CONSTRAINT "EvidenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanOutFailure" (
    "id" TEXT NOT NULL,
    "triggeringFlowId" TEXT NOT NULL,
    "triggeringTaskId" TEXT NOT NULL,
    "triggeringOutcome" TEXT NOT NULL,
    "targetWorkflowId" TEXT NOT NULL,
    "errorReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FanOutFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");

-- CreateIndex
CREATE INDEX "Workflow_companyId_idx" ON "Workflow"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_companyId_name_version_key" ON "Workflow"("companyId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_version_key" ON "WorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Node_workflowId_name_key" ON "Node"("workflowId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Task_nodeId_name_key" ON "Task"("nodeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_taskId_name_key" ON "Outcome"("taskId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_workflowId_sourceNodeId_outcomeName_key" ON "Gate"("workflowId", "sourceNodeId", "outcomeName");

-- CreateIndex
CREATE INDEX "CrossFlowDependency_taskId_idx" ON "CrossFlowDependency"("taskId");

-- CreateIndex
CREATE INDEX "FanOutRule_workflowId_idx" ON "FanOutRule"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowGroup_companyId_scopeType_scopeId_key" ON "FlowGroup"("companyId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "Flow_flowGroupId_idx" ON "Flow"("flowGroupId");

-- CreateIndex
CREATE INDEX "Flow_workflowId_idx" ON "Flow"("workflowId");

-- CreateIndex
CREATE INDEX "NodeActivation_flowId_nodeId_idx" ON "NodeActivation"("flowId", "nodeId");

-- CreateIndex
CREATE INDEX "TaskExecution_flowId_taskId_idx" ON "TaskExecution"("flowId", "taskId");

-- CreateIndex
CREATE INDEX "EvidenceAttachment_flowId_taskId_idx" ON "EvidenceAttachment"("flowId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAttachment_idempotencyKey_key" ON "EvidenceAttachment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FanOutFailure_triggeringFlowId_idx" ON "FanOutFailure"("triggeringFlowId");

-- CreateIndex
CREATE INDEX "FanOutFailure_resolved_idx" ON "FanOutFailure"("resolved");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossFlowDependency" ADD CONSTRAINT "CrossFlowDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanOutRule" ADD CONSTRAINT "FanOutRule_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowGroup" ADD CONSTRAINT "FlowGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeActivation" ADD CONSTRAINT "NodeActivation_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
