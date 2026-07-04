ALTER TABLE "TestRun" ADD COLUMN "queueJobId" TEXT;
ALTER TABLE "TestRun" ADD COLUMN "enqueuedAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "TestRun" ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3);

CREATE INDEX "TestRun_queueJobId_idx" ON "TestRun"("queueJobId");
