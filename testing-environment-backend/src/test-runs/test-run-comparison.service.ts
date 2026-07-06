import { Injectable } from '@nestjs/common';
import { Prisma, TestResult, TestRun, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TestRunExecutionMetadata,
  TestRunImageReference,
} from './types/test-run-execution-metadata.types';
import { TestRunComparisonDto } from './dto/test-run-comparison-response.dto';

type ComparisonRun = TestRun & {
  results: TestResult[];
  environmentConfigRevision: { id: string; revisionNumber: number } | null;
  suiteRevisions: Array<{
    suiteName: string;
    testSuiteRevision: { revisionNumber: number };
  }>;
};

@Injectable()
export class TestRunComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(current: ComparisonRun): Promise<TestRunComparisonDto> {
    const baseline = await this.findBaselineRun(current);
    const baselineRun = baseline
      ? {
          id: baseline.id,
          status: baseline.status,
          finishedAt: baseline.finishedAt?.toISOString() ?? null,
        }
      : null;

    const stepDiffs = this.buildStepDiffs(current.results, baseline?.results ?? []);
    const summary = {
      stepsWithStatusChange: stepDiffs.filter((diff) => diff.statusChanged).length,
      stepsWithTimingRegression: stepDiffs.filter(
        (diff) => (diff.durationRegressionPercent ?? 0) > 20,
      ).length,
    };

    return {
      baselineRun,
      currentRun: {
        id: current.id,
        status: current.status,
        finishedAt: current.finishedAt?.toISOString() ?? null,
      },
      revisions: {
        environment: {
          current: current.environmentConfigRevision
            ? {
                id: current.environmentConfigRevision.id,
                revisionNumber: current.environmentConfigRevision.revisionNumber,
              }
            : null,
          baseline: baseline?.environmentConfigRevision
            ? {
                id: baseline.environmentConfigRevision.id,
                revisionNumber: baseline.environmentConfigRevision.revisionNumber,
              }
            : null,
          changed:
            (current.environmentConfigRevision?.id ?? null) !==
            (baseline?.environmentConfigRevision?.id ?? null),
        },
        suites: this.compareSuiteRevisions(current.suiteRevisions, baseline?.suiteRevisions ?? []),
      },
      imageReferences: this.compareImageReferences(
        this.readImageReferences(current.executionMetadata),
        baseline ? this.readImageReferences(baseline.executionMetadata) : [],
      ),
      stepDiffs,
      summary,
    };
  }

  private async findBaselineRun(current: ComparisonRun): Promise<ComparisonRun | null> {
    if (!current.finishedAt) {
      return null;
    }
    return this.prisma.testRun.findFirst({
      where: {
        projectId: current.projectId,
        status: TestRunStatus.PASSED,
        finishedAt: { lt: current.finishedAt },
      },
      orderBy: { finishedAt: 'desc' },
      include: {
        results: true,
        environmentConfigRevision: true,
        suiteRevisions: {
          orderBy: { position: 'asc' },
          include: { testSuiteRevision: true },
        },
      },
    });
  }

  private compareSuiteRevisions(
    current: ComparisonRun['suiteRevisions'],
    baseline: ComparisonRun['suiteRevisions'],
  ) {
    const baselineByName = new Map(baseline.map((entry) => [entry.suiteName, entry]));
    return current.map((entry) => {
      const baselineEntry = baselineByName.get(entry.suiteName);
      const currentRevisionNumber = entry.testSuiteRevision.revisionNumber;
      const baselineRevisionNumber = baselineEntry?.testSuiteRevision.revisionNumber;
      return {
        suiteName: entry.suiteName,
        currentRevisionNumber,
        baselineRevisionNumber,
        changed: baselineRevisionNumber !== undefined && currentRevisionNumber !== baselineRevisionNumber,
      };
    });
  }

  private compareImageReferences(
    current: TestRunImageReference[],
    baseline: TestRunImageReference[],
  ) {
    const serviceNames = new Set([
      ...current.map((entry) => entry.serviceName),
      ...baseline.map((entry) => entry.serviceName),
    ]);
    const currentByService = new Map(current.map((entry) => [entry.serviceName, entry.image]));
    const baselineByService = new Map(baseline.map((entry) => [entry.serviceName, entry.image]));
    return [...serviceNames].map((serviceName) => {
      const currentImage = currentByService.get(serviceName) ?? null;
      const baselineImage = baselineByService.get(serviceName) ?? null;
      return {
        serviceName,
        current: currentImage,
        baseline: baselineImage,
        changed: currentImage !== baselineImage,
      };
    });
  }

  private buildStepDiffs(currentResults: TestResult[], baselineResults: TestResult[]) {
    const baselineByStepId = new Map(
      baselineResults
        .filter((result) => result.stepId)
        .map((result) => [result.stepId as string, result]),
    );
    const baselineByName = new Map(baselineResults.map((result) => [result.testName, result]));

    return currentResults.map((current) => {
      const baseline =
        (current.stepId ? baselineByStepId.get(current.stepId) : undefined) ??
        baselineByName.get(current.testName);
      const statusChanged = baseline ? baseline.status !== current.status : false;
      const durationRegressionMs =
        baseline && baseline.durationMs !== undefined
          ? current.durationMs - baseline.durationMs
          : undefined;
      const durationRegressionPercent =
        baseline && baseline.durationMs > 0 && durationRegressionMs !== undefined
          ? (durationRegressionMs / baseline.durationMs) * 100
          : undefined;

      return {
        stepId: current.stepId,
        testName: current.testName,
        currentStatus: current.status,
        baselineStatus: baseline?.status,
        statusChanged,
        currentActualStatus: current.actualStatus ?? undefined,
        baselineActualStatus: baseline?.actualStatus ?? undefined,
        currentDurationMs: current.durationMs,
        baselineDurationMs: baseline?.durationMs,
        durationRegressionMs,
        durationRegressionPercent,
      };
    });
  }

  private readImageReferences(value: Prisma.JsonValue | null): TestRunImageReference[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }
    const metadata = value as TestRunExecutionMetadata;
    return metadata.imageReferences ?? [];
  }
}
