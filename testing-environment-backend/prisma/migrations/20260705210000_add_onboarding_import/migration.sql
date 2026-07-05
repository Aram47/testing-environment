-- CreateEnum
ALTER TYPE "EnvironmentConfigType" ADD VALUE 'EXTERNAL_URL';

-- CreateEnum
CREATE TYPE "OnboardingSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "OnboardingSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" "OnboardingSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" TEXT NOT NULL DEFAULT 'project',
    "draftData" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "firstSuccessfulRunAt" TIMESTAMP(3),
    "timeToFirstSuccessfulRunMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingSession_companyId_idx" ON "OnboardingSession"("companyId");

-- CreateIndex
CREATE INDEX "OnboardingSession_userId_status_idx" ON "OnboardingSession"("userId", "status");

-- CreateIndex
CREATE INDEX "OnboardingSession_projectId_idx" ON "OnboardingSession"("projectId");

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
