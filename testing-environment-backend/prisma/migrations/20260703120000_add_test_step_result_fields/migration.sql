ALTER TABLE "TestResult" ADD COLUMN "stepId" TEXT;
ALTER TABLE "TestResult" ADD COLUMN "stepType" TEXT NOT NULL DEFAULT 'apiRequest';
ALTER TABLE "TestResult" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "TestResult_stepId_idx" ON "TestResult"("stepId");
