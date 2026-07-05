-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('SYSTEM_LOG', 'DOCKER_LOG', 'RESPONSE_BODY', 'REPORT_JSON', 'JUNIT_XML');

-- CreateEnum
CREATE TYPE "ArtifactCompression" AS ENUM ('NONE', 'GZIP');

-- AlterTable
ALTER TABLE "TestResult"
ADD COLUMN "responsePreview" JSONB,
ADD COLUMN "responsePreviewTruncated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "responseArtifactId" TEXT;

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "stepId" TEXT,
    "type" "ArtifactType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "compression" "ArtifactCompression" NOT NULL DEFAULT 'NONE',
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunnerLogChunk" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "artifactId" TEXT,
    "source" "RunnerLogSource" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "preview" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunnerLogChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_objectKey_key" ON "Artifact"("objectKey");

-- CreateIndex
CREATE INDEX "Artifact_testRunId_idx" ON "Artifact"("testRunId");

-- CreateIndex
CREATE INDEX "Artifact_stepId_idx" ON "Artifact"("stepId");

-- CreateIndex
CREATE INDEX "Artifact_type_idx" ON "Artifact"("type");

-- CreateIndex
CREATE INDEX "Artifact_retentionUntil_idx" ON "Artifact"("retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RunnerLogChunk_testRunId_source_sequence_key" ON "RunnerLogChunk"("testRunId", "source", "sequence");

-- CreateIndex
CREATE INDEX "RunnerLogChunk_testRunId_idx" ON "RunnerLogChunk"("testRunId");

-- CreateIndex
CREATE INDEX "RunnerLogChunk_artifactId_idx" ON "RunnerLogChunk"("artifactId");

-- CreateIndex
CREATE INDEX "TestResult_responseArtifactId_idx" ON "TestResult"("responseArtifactId");

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunnerLogChunk" ADD CONSTRAINT "RunnerLogChunk_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunnerLogChunk" ADD CONSTRAINT "RunnerLogChunk_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_responseArtifactId_fkey" FOREIGN KEY ("responseArtifactId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
