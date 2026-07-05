import { Injectable } from '@nestjs/common';
import { register, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

type TestRunTerminalStatus = string;

@Injectable()
export class MetricsService {
  private readonly testRunsTotal: Counter<string>;
  private readonly testRunDuration: Histogram<string>;
  private readonly runnerQueueWait: Histogram<string>;
  private readonly environmentStartDuration: Histogram<string>;
  private readonly healthcheckDuration: Histogram<string>;
  private readonly testStepDuration: Histogram<string>;
  private readonly runnerActiveJobs: Gauge<string>;
  private readonly runnerAvailableSlots: Gauge<string>;
  private readonly runnerHeartbeatAge: Gauge<string>;
  private readonly dockerCleanupFailures: Counter<string>;
  private readonly logBytes: Counter<string>;
  private readonly artifactBytes: Counter<string>;
  private readonly stuckRunsCurrent: Gauge<string>;
  private readonly stuckRunsTotal: Counter<string>;

  constructor(private readonly prisma: PrismaService) {
    collectDefaultMetrics({ register, prefix: 'testing_environment_' });
    this.testRunsTotal = this.counter('test_runs_total', 'Completed test runs by status', [
      'status',
    ]);
    this.testRunDuration = this.histogram(
      'test_run_duration_seconds',
      'Test run duration in seconds',
    );
    this.runnerQueueWait = this.histogram(
      'runner_queue_wait_seconds',
      'Time between enqueue and worker claim in seconds',
    );
    this.environmentStartDuration = this.histogram(
      'environment_start_duration_seconds',
      'Docker environment startup duration in seconds',
    );
    this.healthcheckDuration = this.histogram(
      'healthcheck_duration_seconds',
      'Environment healthcheck duration in seconds',
    );
    this.testStepDuration = this.histogram(
      'test_step_duration_seconds',
      'Test step duration in seconds',
      ['type', 'status'],
    );
    this.runnerActiveJobs = this.gauge('runner_active_jobs', 'Runner active jobs');
    this.runnerAvailableSlots = this.gauge('runner_available_slots', 'Runner available slots');
    this.runnerHeartbeatAge = this.gauge(
      'runner_heartbeat_age_seconds',
      'Age of latest runner heartbeat in seconds',
      ['runnerId'],
    );
    this.dockerCleanupFailures = this.counter(
      'docker_cleanup_failures_total',
      'Docker cleanup failures',
    );
    this.logBytes = this.counter('log_bytes_total', 'Persisted log bytes', ['source']);
    this.artifactBytes = this.counter('artifact_bytes_total', 'Persisted artifact bytes', ['type']);
    this.stuckRunsCurrent = this.gauge('stuck_test_runs_current', 'Current stuck test runs', [
      'reason',
    ]);
    this.stuckRunsTotal = this.counter('stuck_test_runs_total', 'Observed stuck test runs', [
      'reason',
    ]);
  }

  async render(): Promise<string> {
    await this.refreshDatabaseGauges();
    return register.metrics();
  }

  contentType(): string {
    return register.contentType;
  }

  recordTestRun(status: TestRunTerminalStatus, durationMs?: number | null): void {
    this.testRunsTotal.inc({ status });
    if (durationMs && durationMs > 0) {
      this.testRunDuration.observe(durationMs / 1000);
    }
  }

  recordQueueWait(enqueuedAt?: Date | null, claimedAt?: Date | null): void {
    if (!enqueuedAt || !claimedAt) {
      return;
    }
    this.runnerQueueWait.observe(Math.max(0, claimedAt.getTime() - enqueuedAt.getTime()) / 1000);
  }

  observeEnvironmentStart(durationMs: number): void {
    this.environmentStartDuration.observe(durationMs / 1000);
  }

  observeHealthcheck(durationMs: number): void {
    this.healthcheckDuration.observe(durationMs / 1000);
  }

  observeStep(type: string, status: string, durationMs: number): void {
    this.testStepDuration.observe({ type, status }, durationMs / 1000);
  }

  setRunnerSlots(activeJobs: number, availableSlots: number): void {
    this.runnerActiveJobs.set(activeJobs);
    this.runnerAvailableSlots.set(availableSlots);
  }

  incrementDockerCleanupFailure(): void {
    this.dockerCleanupFailures.inc();
  }

  incrementLogBytes(source: string, bytes: number): void {
    if (bytes > 0) {
      this.logBytes.inc({ source }, bytes);
    }
  }

  incrementArtifactBytes(type: string, bytes: number): void {
    if (bytes > 0) {
      this.artifactBytes.inc({ type }, bytes);
    }
  }

  recordStuckRun(reason: string): void {
    this.stuckRunsTotal.inc({ reason });
  }

  private async refreshDatabaseGauges(): Promise<void> {
    await Promise.all([this.refreshHeartbeatAge(), this.refreshStuckRuns()]);
  }

  private async refreshHeartbeatAge(): Promise<void> {
    const rows = await this.prisma.testRun.groupBy({
      by: ['runnerId'],
      where: { runnerId: { not: null }, heartbeatAt: { not: null }, finishedAt: null },
      _max: { heartbeatAt: true },
    });
    const now = Date.now();
    for (const row of rows) {
      if (row.runnerId && row._max.heartbeatAt) {
        this.runnerHeartbeatAge.set(
          { runnerId: row.runnerId },
          Math.max(0, now - row._max.heartbeatAt.getTime()) / 1000,
        );
      }
    }
  }

  private async refreshStuckRuns(): Promise<void> {
    const now = new Date();
    const expiredLease = await this.prisma.testRun.count({
      where: { finishedAt: null, leaseExpiresAt: { lt: now } },
    });
    const staleQueued = await this.prisma.testRun.count({
      where: {
        status: { in: ['CREATED', 'QUEUED'] },
        finishedAt: null,
        createdAt: { lt: new Date(now.getTime() - this.stuckQueuedMs()) },
      },
    });
    this.stuckRunsCurrent.set({ reason: 'expired_lease' }, expiredLease);
    this.stuckRunsCurrent.set({ reason: 'stale_queued' }, staleQueued);
  }

  private stuckQueuedMs(): number {
    const parsed = Number(process.env.TEST_RUN_STUCK_QUEUED_MS ?? 5 * 60 * 1000);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
  }

  private counter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    return new Counter({ name, help, labelNames });
  }

  private gauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    return new Gauge({ name, help, labelNames });
  }

  private histogram(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): Histogram<string> {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
    });
  }
}
