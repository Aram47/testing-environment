-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN "executionMetadata" JSONB;

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN "assertionResults" JSONB;
ALTER TABLE "TestResult" ADD COLUMN "variablesSnapshot" JSONB;
ALTER TABLE "TestResult" ADD COLUMN "requestHeaders" JSONB;
ALTER TABLE "TestResult" ADD COLUMN "responseHeaders" JSONB;
