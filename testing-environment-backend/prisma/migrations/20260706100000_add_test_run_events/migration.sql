-- Durable realtime event stream for reconnect recovery.
ALTER TABLE "TestRun" ADD COLUMN "eventSequence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TestRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestRunEvent_runId_sequence_key" ON "TestRunEvent"("runId", "sequence");
CREATE INDEX "TestRunEvent_runId_sequence_idx" ON "TestRunEvent"("runId", "sequence");

ALTER TABLE "TestRunEvent"
ADD CONSTRAINT "TestRunEvent_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "TestRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
