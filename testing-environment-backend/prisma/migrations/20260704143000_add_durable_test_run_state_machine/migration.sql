-- CreateEnum
CREATE TYPE "TestRunFailureCategory" AS ENUM (
    'TEST_ASSERTION',
    'ENVIRONMENT_VALIDATION',
    'IMAGE_PULL',
    'CONTAINER_START',
    'HEALTHCHECK',
    'NETWORK',
    'TIMEOUT',
    'CANCELLED',
    'INTERNAL'
);

-- Replace the old compact TestRunStatus enum with the durable state machine enum.
ALTER TYPE "TestRunStatus" RENAME TO "TestRunStatus_old";

CREATE TYPE "TestRunStatus" AS ENUM (
    'CREATED',
    'QUEUED',
    'CLAIMED',
    'PREPARING_WORKSPACE',
    'VALIDATING_ENVIRONMENT',
    'PULLING_IMAGES',
    'STARTING_ENVIRONMENT',
    'WAITING_FOR_HEALTHCHECK',
    'EXECUTING_TESTS',
    'COLLECTING_ARTIFACTS',
    'CLEANING_UP',
    'PASSED',
    'TEST_FAILED',
    'INFRA_FAILED',
    'TIMED_OUT',
    'CANCEL_REQUESTED',
    'CANCELLED'
);

ALTER TABLE "TestRun" ADD COLUMN "status_new" "TestRunStatus" NOT NULL DEFAULT 'CREATED';

UPDATE "TestRun"
SET "status_new" = CASE "status"::TEXT
    WHEN 'PENDING' THEN 'QUEUED'::"TestRunStatus"
    WHEN 'RUNNING' THEN 'EXECUTING_TESTS'::"TestRunStatus"
    WHEN 'PASSED' THEN 'PASSED'::"TestRunStatus"
    WHEN 'FAILED' THEN 'INFRA_FAILED'::"TestRunStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"TestRunStatus"
    ELSE 'CREATED'::"TestRunStatus"
END;

DROP INDEX IF EXISTS "TestRun_status_idx";

ALTER TABLE "TestRun" DROP COLUMN "status";
ALTER TABLE "TestRun" RENAME COLUMN "status_new" TO "status";

DROP TYPE "TestRunStatus_old";

ALTER TABLE "TestRun" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "failureCategory" "TestRunFailureCategory";
ALTER TABLE "TestRun" ADD COLUMN "currentPhase" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "phaseTimestamps" JSONB;
ALTER TABLE "TestRun" ADD COLUMN "queuedAt" TIMESTAMP(3);

UPDATE "TestRun"
SET
    "queuedAt" = COALESCE("enqueuedAt", "createdAt"),
    "currentPhase" = CASE
        WHEN "status" IN (
            'PREPARING_WORKSPACE',
            'VALIDATING_ENVIRONMENT',
            'PULLING_IMAGES',
            'STARTING_ENVIRONMENT',
            'WAITING_FOR_HEALTHCHECK',
            'EXECUTING_TESTS',
            'COLLECTING_ARTIFACTS',
            'CLEANING_UP'
        ) THEN "status"::TEXT
        ELSE NULL
    END,
    "failureCategory" = CASE
        WHEN "status" = 'INFRA_FAILED' THEN 'INTERNAL'::"TestRunFailureCategory"
        WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"TestRunFailureCategory"
        ELSE NULL
    END,
    "statusReason" = CASE
        WHEN "status" = 'INFRA_FAILED' THEN COALESCE("errorMessage", 'Migrated from legacy FAILED status')
        ELSE NULL
    END;

CREATE INDEX "TestRun_status_idx" ON "TestRun"("status");
