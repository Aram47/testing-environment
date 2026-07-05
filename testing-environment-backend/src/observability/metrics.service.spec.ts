import { register } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  beforeEach(() => {
    register.clear();
  });

  it('records requested counters and histograms', async () => {
    const service = new MetricsService(createPrisma() as unknown as PrismaService);

    service.recordTestRun('PASSED', 1200);
    service.recordQueueWait(
      new Date('2026-07-05T00:00:00.000Z'),
      new Date('2026-07-05T00:00:02.000Z'),
    );
    service.observeStep('apiRequest', 'PASSED', 300);
    service.incrementLogBytes('SYSTEM', 42);
    service.incrementArtifactBytes('RESPONSE_BODY', 128);
    service.incrementDockerCleanupFailure();
    service.recordTimeToFirstSuccessfulRun(90000);

    const output = await service.render();

    expect(output).toContain('test_runs_total{status="PASSED"} 1');
    expect(output).toContain('runner_queue_wait_seconds_count 1');
    expect(output).toContain(
      'test_step_duration_seconds_count{type="apiRequest",status="PASSED"} 1',
    );
    expect(output).toContain('log_bytes_total{source="SYSTEM"} 42');
    expect(output).toContain('artifact_bytes_total{type="RESPONSE_BODY"} 128');
    expect(output).toContain('docker_cleanup_failures_total 1');
    expect(output).toContain('onboarding_first_successful_runs_total 1');
    expect(output).toContain('onboarding_time_to_first_successful_run_seconds_count 1');
  });

  it('exposes stuck run gauges from existing TestRun fields', async () => {
    const prisma = createPrisma({ expiredLeaseCount: 2, staleQueuedCount: 1 });
    const service = new MetricsService(prisma as unknown as PrismaService);

    const output = await service.render();

    expect(output).toContain('stuck_test_runs_current{reason="expired_lease"} 2');
    expect(output).toContain('stuck_test_runs_current{reason="stale_queued"} 1');
  });
});

function createPrisma(options: { expiredLeaseCount?: number; staleQueuedCount?: number } = {}) {
  return {
    testRun: {
      groupBy: jest.fn(() => Promise.resolve([])),
      count: jest
        .fn()
        .mockResolvedValueOnce(options.expiredLeaseCount ?? 0)
        .mockResolvedValueOnce(options.staleQueuedCount ?? 0),
    },
  };
}
