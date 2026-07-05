import { Injectable } from '@nestjs/common';
import { ArtifactCompression, ArtifactType, TestResultStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toJsonBuffer } from './artifact-utils';
import { ArtifactsService } from './artifacts.service';

export const REPORT_SCHEMA_VERSION = 2;

@Injectable()
export class ReportArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactsService,
  ) {}

  async generateForRun(testRunId: string): Promise<void> {
    const run = await this.loadRun(testRunId);
    if (!run) {
      return;
    }
    const report = this.toReport(run);
    await this.artifacts.putOrReplace({
      testRunId,
      type: ArtifactType.REPORT_JSON,
      objectKey: `runs/${testRunId}/report.json`,
      mimeType: 'application/json',
      data: toJsonBuffer(report),
      compression: ArtifactCompression.NONE,
      retentionUntil: this.artifacts.retentionUntil(),
    });
    await this.artifacts.putOrReplace({
      testRunId,
      type: ArtifactType.JUNIT_XML,
      objectKey: `runs/${testRunId}/junit.xml`,
      mimeType: 'application/xml',
      data: Buffer.from(this.toJUnitXml(run), 'utf8'),
      compression: ArtifactCompression.NONE,
      retentionUntil: this.artifacts.retentionUntil(),
    });
    await this.prisma.testRun.update({
      where: { id: testRunId },
      data: { reportSchemaVersion: REPORT_SCHEMA_VERSION },
    });
  }

  async buildLegacyReport(projectId: string, runId: string) {
    const run = await this.loadRun(runId, projectId);
    return run ? this.toReport(run) : null;
  }

  async buildLegacyJunit(projectId: string, runId: string): Promise<string | null> {
    const run = await this.loadRun(runId, projectId);
    return run ? this.toJUnitXml(run) : null;
  }

  private loadRun(runId: string, projectId?: string) {
    return this.prisma.testRun.findFirst({
      where: { id: runId, ...(projectId ? { projectId } : {}) },
      include: {
        project: true,
        environmentConfigRevision: true,
        suiteRevisions: {
          orderBy: { position: 'asc' },
          include: { testSuiteRevision: true },
        },
        results: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private toReport(run: NonNullable<Awaited<ReturnType<ReportArtifactService['loadRun']>>>) {
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      run: {
        id: run.id,
        projectId: run.projectId,
        status: run.status,
        runnerVersion: run.runnerVersion,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        totalTests: run.totalTests,
        passedTests: run.passedTests,
        failedTests: run.failedTests,
        failureCategory: run.failureCategory,
        errorMessage: run.errorMessage,
      },
      revisions: {
        environmentConfigRevisionId: run.environmentConfigRevisionId,
        environmentConfigRevisionNumber: run.environmentConfigRevision?.revisionNumber,
        testSuiteRevisionIds: run.suiteRevisions.map((suite) => suite.testSuiteRevisionId),
        testSuites: run.suiteRevisions.map((suite) => ({
          suiteName: suite.suiteName,
          testSuiteId: suite.testSuiteId,
          testSuiteRevisionId: suite.testSuiteRevisionId,
          revisionNumber: suite.testSuiteRevision.revisionNumber,
        })),
      },
      results: run.results.map((result) => ({
        id: result.id,
        stepId: result.stepId,
        stepType: result.stepType,
        suiteName: result.suiteName,
        testName: result.testName,
        status: result.status,
        method: result.method,
        path: result.path,
        expectedStatus: result.expectedStatus,
        actualStatus: result.actualStatus,
        attempts: result.attempts,
        durationMs: result.durationMs,
        requestBody: result.requestBody,
        responsePreview: result.responsePreview ?? result.responseBody,
        responsePreviewTruncated: result.responsePreviewTruncated,
        responseArtifactId: result.responseArtifactId,
        errorMessage: result.errorMessage,
        createdAt: result.createdAt,
      })),
    };
  }

  private toJUnitXml(
    run: NonNullable<Awaited<ReturnType<ReportArtifactService['loadRun']>>>,
  ): string {
    const tests = run.results;
    const failures = tests.filter((test) => test.status === TestResultStatus.FAILED).length;
    const cases = tests
      .map((test) => {
        const attrs = [
          `classname="${this.escapeXml(test.suiteName)}"`,
          `name="${this.escapeXml(test.testName)}"`,
          `time="${((test.durationMs ?? 0) / 1000).toFixed(3)}"`,
        ].join(' ');
        const failure =
          test.status === TestResultStatus.FAILED
            ? `<failure message="${this.escapeXml(test.errorMessage ?? 'Test failed')}"></failure>`
            : '';
        return `<testcase ${attrs}>${failure}</testcase>`;
      })
      .join('');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuite name="test-run-${this.escapeXml(run.id)}" tests="${tests.length}" failures="${failures}" time="${((run.durationMs ?? 0) / 1000).toFixed(3)}">`,
      cases,
      '</testsuite>',
    ].join('');
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
