-- CreateEnum
CREATE TYPE "EnvironmentDryRunStatus" AS ENUM ('CREATED', 'QUEUED', 'PREPARING_WORKSPACE', 'VALIDATING_ENVIRONMENT', 'PULLING_IMAGES', 'STARTING_ENVIRONMENT', 'WAITING_FOR_HEALTHCHECK', 'COLLECTING_LOGS', 'CLEANING_UP', 'PASSED', 'INFRA_FAILED', 'TIMED_OUT', 'CANCEL_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnvironmentDryRunFailureCategory" AS ENUM ('ENVIRONMENT_VALIDATION', 'IMAGE_PULL', 'CONTAINER_START', 'HEALTHCHECK', 'NETWORK', 'TIMEOUT', 'CANCELLED', 'INTERNAL');

-- CreateTable
CREATE TABLE "EnvironmentDryRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentConfigRevisionId" TEXT NOT NULL,
    "status" "EnvironmentDryRunStatus" NOT NULL DEFAULT 'CREATED',
    "queueJobId" TEXT,
    "runnerVersion" TEXT,
    "failureCategory" "EnvironmentDryRunFailureCategory",
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentDryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentDryRunLog" (
    "id" TEXT NOT NULL,
    "dryRunId" TEXT NOT NULL,
    "source" "RunnerLogSource" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentDryRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvironmentDryRun_projectId_createdAt_idx" ON "EnvironmentDryRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "EnvironmentDryRun_environmentConfigRevisionId_idx" ON "EnvironmentDryRun"("environmentConfigRevisionId");

-- CreateIndex
CREATE INDEX "EnvironmentDryRun_status_idx" ON "EnvironmentDryRun"("status");

-- CreateIndex
CREATE INDEX "EnvironmentDryRunLog_dryRunId_createdAt_idx" ON "EnvironmentDryRunLog"("dryRunId", "createdAt");

-- AddForeignKey
ALTER TABLE "EnvironmentDryRun" ADD CONSTRAINT "EnvironmentDryRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentDryRun" ADD CONSTRAINT "EnvironmentDryRun_environmentConfigRevisionId_fkey" FOREIGN KEY ("environmentConfigRevisionId") REFERENCES "EnvironmentConfigRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentDryRunLog" ADD CONSTRAINT "EnvironmentDryRunLog_dryRunId_fkey" FOREIGN KEY ("dryRunId") REFERENCES "EnvironmentDryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
