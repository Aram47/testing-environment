CREATE TYPE "CompanyMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'DEVELOPER', 'VIEWER');
CREATE TYPE "PrincipalType" AS ENUM ('USER', 'SERVICE_ACCOUNT', 'API_TOKEN');

CREATE TABLE "CompanyMember" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ProjectRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "invitedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiToken" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "serviceAccountId" TEXT,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" TEXT[],
  "projectId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CompanyMember" ("id", "companyId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT 'company-member-' || "id", "companyId", "id", "role", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT DO NOTHING;

ALTER TABLE "AuditEvent"
  ADD COLUMN "action" TEXT,
  ADD COLUMN "actorType" "PrincipalType" NOT NULL DEFAULT 'USER',
  ADD COLUMN "serviceAccountId" TEXT,
  ADD COLUMN "apiTokenId" TEXT,
  ADD COLUMN "resourceType" TEXT,
  ADD COLUMN "requestId" TEXT;

UPDATE "AuditEvent" SET "action" = "type" WHERE "action" IS NULL;
ALTER TABLE "AuditEvent" ALTER COLUMN "action" SET NOT NULL;

CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");
CREATE INDEX "CompanyMember_userId_status_idx" ON "CompanyMember"("userId", "status");
CREATE INDEX "CompanyMember_companyId_status_role_idx" ON "CompanyMember"("companyId", "status", "role");

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "ProjectMember_projectId_role_idx" ON "ProjectMember"("projectId", "role");

CREATE INDEX "Invitation_companyId_idx" ON "Invitation"("companyId");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_acceptedAt_revokedAt_idx" ON "Invitation"("acceptedAt", "revokedAt");

CREATE INDEX "ServiceAccount_companyId_idx" ON "ServiceAccount"("companyId");
CREATE INDEX "ServiceAccount_revokedAt_idx" ON "ServiceAccount"("revokedAt");

CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX "ApiToken_companyId_idx" ON "ApiToken"("companyId");
CREATE INDEX "ApiToken_projectId_idx" ON "ApiToken"("projectId");
CREATE INDEX "ApiToken_serviceAccountId_idx" ON "ApiToken"("serviceAccountId");
CREATE INDEX "ApiToken_revokedAt_idx" ON "ApiToken"("revokedAt");

CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");
CREATE INDEX "AuditEvent_serviceAccountId_idx" ON "AuditEvent"("serviceAccountId");
CREATE INDEX "AuditEvent_apiTokenId_idx" ON "AuditEvent"("apiTokenId");
CREATE INDEX "AuditEvent_resourceType_resourceId_idx" ON "AuditEvent"("resourceType", "resourceId");
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "ServiceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
