-- CreateEnum
CREATE TYPE "AssigneeType" AS ENUM ('PERSON', 'EXTERNAL');

-- CreateTable
CREATE TABLE "ExternalParty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "assigneeType" "AssigneeType" NOT NULL,
    "memberId" TEXT,
    "externalPartyId" TEXT,
    "assignedByMemberId" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalParty_companyId_idx" ON "ExternalParty"("companyId");

-- CreateIndex
CREATE INDEX "JobAssignment_jobId_slotKey_supersededAt_idx" ON "JobAssignment"("jobId", "slotKey", "supersededAt");

-- CreateIndex
CREATE INDEX "JobAssignment_memberId_supersededAt_idx" ON "JobAssignment"("memberId", "supersededAt");

-- CreateIndex
CREATE INDEX "JobAssignment_externalPartyId_supersededAt_idx" ON "JobAssignment"("externalPartyId", "supersededAt");

-- AddForeignKey
ALTER TABLE "ExternalParty" ADD CONSTRAINT "ExternalParty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_externalPartyId_fkey" FOREIGN KEY ("externalPartyId") REFERENCES "ExternalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_assignedByMemberId_fkey" FOREIGN KEY ("assignedByMemberId") REFERENCES "CompanyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
