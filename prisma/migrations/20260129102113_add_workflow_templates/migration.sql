-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedBy" TEXT,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "tradeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowTemplate_tradeKey_category_idx" ON "WorkflowTemplate"("tradeKey", "category");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_tradeKey_name_version_key" ON "WorkflowTemplate"("tradeKey", "name", "version");
