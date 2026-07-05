CREATE TYPE "SecretRotationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "Secret"
  ADD COLUMN "encryptionKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "rotatedAt" TIMESTAMP(3);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT,
  "actorUserId" TEXT,
  "resourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretRotationJob" (
  "id" TEXT NOT NULL,
  "status" "SecretRotationJobStatus" NOT NULL DEFAULT 'PENDING',
  "companyId" TEXT,
  "fromKeyVersion" TEXT NOT NULL,
  "toKeyVersion" TEXT NOT NULL,
  "totalSecrets" INTEGER NOT NULL DEFAULT 0,
  "processedSecrets" INTEGER NOT NULL DEFAULT 0,
  "lastProcessedSecretId" TEXT,
  "errorMessage" TEXT,
  "actorUserId" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecretRotationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Secret_createdById_idx" ON "Secret"("createdById");
CREATE INDEX "Secret_encryptionKeyVersion_idx" ON "Secret"("encryptionKeyVersion");
CREATE INDEX "AuditEvent_type_idx" ON "AuditEvent"("type");
CREATE INDEX "AuditEvent_companyId_idx" ON "AuditEvent"("companyId");
CREATE INDEX "AuditEvent_projectId_idx" ON "AuditEvent"("projectId");
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");
CREATE INDEX "AuditEvent_resourceId_idx" ON "AuditEvent"("resourceId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "SecretRotationJob_status_idx" ON "SecretRotationJob"("status");
CREATE INDEX "SecretRotationJob_companyId_idx" ON "SecretRotationJob"("companyId");
CREATE INDEX "SecretRotationJob_fromKeyVersion_toKeyVersion_idx" ON "SecretRotationJob"("fromKeyVersion", "toKeyVersion");
CREATE UNIQUE INDEX "SecretRotationJob_active_company_pair_key" ON "SecretRotationJob"("companyId", "fromKeyVersion", "toKeyVersion")
  WHERE "status" IN ('PENDING', 'RUNNING');
CREATE INDEX "SecretRotationJob_actorUserId_idx" ON "SecretRotationJob"("actorUserId");
CREATE INDEX "SecretRotationJob_createdAt_idx" ON "SecretRotationJob"("createdAt");

ALTER TABLE "Secret"
  ADD CONSTRAINT "Secret_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecretRotationJob"
  ADD CONSTRAINT "SecretRotationJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecretRotationJob"
  ADD CONSTRAINT "SecretRotationJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
