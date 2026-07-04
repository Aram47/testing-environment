ALTER TABLE "TestRun" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "cancelRequestedBy" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "runnerId" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "leaseAcquiredAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestRun" ADD COLUMN "cleanupError" TEXT;

UPDATE "TestRun"
SET "cancelRequestedAt" = "cancellationRequestedAt"
WHERE "cancellationRequestedAt" IS NOT NULL;

CREATE INDEX "TestRun_runnerId_idx" ON "TestRun"("runnerId");
CREATE INDEX "TestRun_leaseExpiresAt_idx" ON "TestRun"("leaseExpiresAt");
