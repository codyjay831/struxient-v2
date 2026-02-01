-- Enforce "exactly one assignee" rule
ALTER TABLE "JobAssignment" ADD CONSTRAINT "job_assignment_assignee_check" CHECK (
    ("assigneeType" = 'PERSON' AND "memberId" IS NOT NULL AND "externalPartyId" IS NULL) OR
    ("assigneeType" = 'EXTERNAL' AND "externalPartyId" IS NOT NULL AND "memberId" IS NULL)
);
