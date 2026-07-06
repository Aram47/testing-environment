import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EnvironmentDryRunFailureCategory,
  EnvironmentDryRunStatus,
  Prisma,
  RunnerLogSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnvironmentDryRunStateService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(dryRunId: string) {
    const dryRun = await this.prisma.environmentDryRun.findUnique({ where: { id: dryRunId } });
    if (!dryRun) {
      throw new NotFoundException('Environment dry run not found');
    }
    return dryRun;
  }

  async markQueued(dryRunId: string, queueJobId: string) {
    return this.transition(dryRunId, EnvironmentDryRunStatus.CREATED, EnvironmentDryRunStatus.QUEUED, {
      queueJobId,
    });
  }

  async enterPhase(dryRunId: string, status: EnvironmentDryRunStatus) {
    const dryRun = await this.getById(dryRunId);
    return this.prisma.environmentDryRun.update({
      where: { id: dryRunId },
      data: {
        status,
        startedAt: dryRun.startedAt ?? new Date(),
      },
    });
  }

  async markPassed(dryRunId: string) {
    return this.prisma.environmentDryRun.update({
      where: { id: dryRunId },
      data: {
        status: EnvironmentDryRunStatus.PASSED,
        finishedAt: new Date(),
      },
    });
  }

  async markInfraFailed(
    dryRunId: string,
    failureCategory: EnvironmentDryRunFailureCategory,
    errorMessage: string,
  ) {
    return this.prisma.environmentDryRun.update({
      where: { id: dryRunId },
      data: {
        status: EnvironmentDryRunStatus.INFRA_FAILED,
        failureCategory,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async requestCancel(dryRunId: string) {
    return this.prisma.environmentDryRun.update({
      where: { id: dryRunId },
      data: {
        status: EnvironmentDryRunStatus.CANCEL_REQUESTED,
        cancelRequestedAt: new Date(),
      },
    });
  }

  async markCancelled(dryRunId: string, errorMessage?: string) {
    return this.prisma.environmentDryRun.update({
      where: { id: dryRunId },
      data: {
        status: EnvironmentDryRunStatus.CANCELLED,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async isCancellationRequested(dryRunId: string): Promise<boolean> {
    const dryRun = await this.prisma.environmentDryRun.findUnique({
      where: { id: dryRunId },
      select: { status: true, cancelRequestedAt: true },
    });
    return (
      dryRun?.status === EnvironmentDryRunStatus.CANCEL_REQUESTED ||
      Boolean(dryRun?.cancelRequestedAt)
    );
  }

  async appendLog(dryRunId: string, source: RunnerLogSource, message: string) {
    const existingCount = await this.prisma.environmentDryRunLog.count({ where: { dryRunId } });
    if (existingCount >= 500) {
      return;
    }
    await this.prisma.environmentDryRunLog.create({
      data: {
        dryRunId,
        source,
        message: message.slice(0, 20000),
      },
    });
  }

  private async transition(
    dryRunId: string,
    from: EnvironmentDryRunStatus,
    to: EnvironmentDryRunStatus,
    data: Prisma.EnvironmentDryRunUpdateInput = {},
  ) {
    const result = await this.prisma.environmentDryRun.updateMany({
      where: { id: dryRunId, status: from },
      data: { status: to, ...data },
    });
    if (result.count === 0) {
      throw new NotFoundException('Environment dry run transition failed');
    }
    return this.getById(dryRunId);
  }
}
