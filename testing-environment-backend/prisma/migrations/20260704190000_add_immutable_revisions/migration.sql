-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "TestSuite" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestRun"
  ADD COLUMN "environmentConfigRevisionId" TEXT,
  ADD COLUMN "runnerVersion" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "reportSchemaVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "EnvironmentConfigRevision" (
    "id" TEXT NOT NULL,
    "environmentConfigId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceMode" TEXT NOT NULL,
    "visualConfig" JSONB,
    "compiledComposeYaml" TEXT NOT NULL,
    "compiledRuntimeYaml" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentConfigRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuiteRevision" (
    "id" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceMode" TEXT NOT NULL,
    "visualFlow" JSONB,
    "compiledYaml" TEXT NOT NULL,
    "executionPlan" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSuiteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRunSuiteRevision" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testSuiteId" TEXT,
    "testSuiteRevisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "suiteName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunSuiteRevision_pkey" PRIMARY KEY ("id")
);

-- Backfill initial published revisions from existing mutable records.
INSERT INTO "EnvironmentConfigRevision" (
  "id",
  "environmentConfigId",
  "revisionNumber",
  "status",
  "sourceMode",
  "visualConfig",
  "compiledComposeYaml",
  "compiledRuntimeYaml",
  "schemaVersion",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5("id" || ':environment-revision:1'),
  "id",
  1,
  'PUBLISHED'::"RevisionStatus",
  CASE
    WHEN "visualConfig" IS NULL OR "visualConfig" = 'null'::jsonb THEN 'YAML'
    ELSE 'VISUAL'
  END,
  "visualConfig",
  "composeYaml",
  "backendTestYaml",
  1,
  "createdAt",
  "createdAt",
  "updatedAt"
FROM "EnvironmentConfig";

INSERT INTO "TestSuiteRevision" (
  "id",
  "testSuiteId",
  "revisionNumber",
  "status",
  "sourceMode",
  "visualFlow",
  "compiledYaml",
  "executionPlan",
  "schemaVersion",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5("id" || ':test-suite-revision:1'),
  "id",
  1,
  'PUBLISHED'::"RevisionStatus",
  CASE
    WHEN "visualFlow" IS NULL OR "visualFlow" = 'null'::jsonb THEN 'YAML'
    ELSE 'VISUAL'
  END,
  "visualFlow",
  "yamlContent",
  jsonb_build_object('schemaVersion', 1, 'source', 'legacy-yaml'),
  1,
  "createdAt",
  "createdAt",
  "updatedAt"
FROM "TestSuite";

UPDATE "TestRun" AS tr
SET "environmentConfigRevisionId" = ecr."id"
FROM "EnvironmentConfig" AS ec
JOIN "EnvironmentConfigRevision" AS ecr ON ecr."environmentConfigId" = ec."id"
WHERE ec."projectId" = tr."projectId"
  AND ecr."revisionNumber" = 1
  AND tr."environmentConfigRevisionId" IS NULL;

INSERT INTO "TestRunSuiteRevision" (
  "id",
  "testRunId",
  "testSuiteId",
  "testSuiteRevisionId",
  "position",
  "suiteName",
  "createdAt"
)
SELECT
  md5(tr."id" || ':' || tsr."id"),
  tr."id",
  ts."id",
  tsr."id",
  ROW_NUMBER() OVER (PARTITION BY tr."id" ORDER BY ts."createdAt", ts."id") - 1,
  ts."name",
  tr."createdAt"
FROM "TestRun" AS tr
JOIN "TestSuite" AS ts ON ts."projectId" = tr."projectId"
JOIN "TestSuiteRevision" AS tsr ON tsr."testSuiteId" = ts."id" AND tsr."revisionNumber" = 1;

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentConfigRevision_environmentConfigId_revisionNumber_key" ON "EnvironmentConfigRevision"("environmentConfigId", "revisionNumber");
CREATE INDEX "EnvironmentConfigRevision_environmentConfigId_status_revisionNumber_idx" ON "EnvironmentConfigRevision"("environmentConfigId", "status", "revisionNumber");
CREATE INDEX "EnvironmentConfigRevision_createdById_idx" ON "EnvironmentConfigRevision"("createdById");
CREATE INDEX "EnvironmentConfigRevision_publishedById_idx" ON "EnvironmentConfigRevision"("publishedById");

CREATE INDEX "TestSuite_projectId_deletedAt_idx" ON "TestSuite"("projectId", "deletedAt");
CREATE UNIQUE INDEX "TestSuiteRevision_testSuiteId_revisionNumber_key" ON "TestSuiteRevision"("testSuiteId", "revisionNumber");
CREATE INDEX "TestSuiteRevision_testSuiteId_status_revisionNumber_idx" ON "TestSuiteRevision"("testSuiteId", "status", "revisionNumber");
CREATE INDEX "TestSuiteRevision_createdById_idx" ON "TestSuiteRevision"("createdById");
CREATE INDEX "TestSuiteRevision_publishedById_idx" ON "TestSuiteRevision"("publishedById");

CREATE INDEX "TestRun_environmentConfigRevisionId_idx" ON "TestRun"("environmentConfigRevisionId");
CREATE UNIQUE INDEX "TestRunSuiteRevision_testRunId_testSuiteRevisionId_key" ON "TestRunSuiteRevision"("testRunId", "testSuiteRevisionId");
CREATE UNIQUE INDEX "TestRunSuiteRevision_testRunId_position_key" ON "TestRunSuiteRevision"("testRunId", "position");
CREATE INDEX "TestRunSuiteRevision_testSuiteId_idx" ON "TestRunSuiteRevision"("testSuiteId");
CREATE INDEX "TestRunSuiteRevision_testSuiteRevisionId_idx" ON "TestRunSuiteRevision"("testSuiteRevisionId");

-- AddForeignKey
ALTER TABLE "EnvironmentConfigRevision" ADD CONSTRAINT "EnvironmentConfigRevision_environmentConfigId_fkey" FOREIGN KEY ("environmentConfigId") REFERENCES "EnvironmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnvironmentConfigRevision" ADD CONSTRAINT "EnvironmentConfigRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnvironmentConfigRevision" ADD CONSTRAINT "EnvironmentConfigRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestSuiteRevision" ADD CONSTRAINT "TestSuiteRevision_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuiteRevision" ADD CONSTRAINT "TestSuiteRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestSuiteRevision" ADD CONSTRAINT "TestSuiteRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_environmentConfigRevisionId_fkey" FOREIGN KEY ("environmentConfigRevisionId") REFERENCES "EnvironmentConfigRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestRunSuiteRevision" ADD CONSTRAINT "TestRunSuiteRevision_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestRunSuiteRevision" ADD CONSTRAINT "TestRunSuiteRevision_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRunSuiteRevision" ADD CONSTRAINT "TestRunSuiteRevision_testSuiteRevisionId_fkey" FOREIGN KEY ("testSuiteRevisionId") REFERENCES "TestSuiteRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old mutable content columns after backfill.
ALTER TABLE "EnvironmentConfig"
  DROP COLUMN "composeYaml",
  DROP COLUMN "backendTestYaml",
  DROP COLUMN "visualConfig";

ALTER TABLE "TestSuite"
  DROP COLUMN "yamlContent",
  DROP COLUMN "visualFlow";
