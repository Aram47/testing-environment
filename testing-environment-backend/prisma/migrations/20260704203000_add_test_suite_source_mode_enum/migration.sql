-- CreateEnum
CREATE TYPE "TestSuiteSourceMode" AS ENUM ('VISUAL', 'RAW_YAML');

-- Normalize legacy source mode values before converting the column.
UPDATE "TestSuiteRevision"
SET "sourceMode" = CASE
  WHEN "sourceMode" = 'VISUAL' THEN 'VISUAL'
  ELSE 'RAW_YAML'
END;

-- AlterTable
ALTER TABLE "TestSuiteRevision"
  ALTER COLUMN "sourceMode" TYPE "TestSuiteSourceMode"
  USING "sourceMode"::"TestSuiteSourceMode";

-- Remove old placeholder plans so the runner rebuilds them through the legacy YAML fallback.
UPDATE "TestSuiteRevision"
SET "executionPlan" = NULL
WHERE "executionPlan" IS NOT NULL
  AND "executionPlan"->>'schemaVersion' IS DISTINCT FROM 'execution-plan/v1';
