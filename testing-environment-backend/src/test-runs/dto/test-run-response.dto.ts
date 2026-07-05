import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';

export class TestRunResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  environmentConfigRevisionId?: string | null;

  @ApiProperty()
  runnerVersion!: string;

  @ApiProperty()
  reportSchemaVersion!: number;

  @ApiProperty({ enum: TestRunStatus })
  status!: TestRunStatus;

  @ApiPropertyOptional({
    description: 'Human-readable terminal or cancellation reason for the current run state.',
  })
  statusReason?: string | null;

  @ApiPropertyOptional({ enum: TestRunFailureCategory })
  failureCategory?: TestRunFailureCategory | null;

  @ApiPropertyOptional()
  currentPhase?: string | null;

  @ApiPropertyOptional({ type: Object })
  phaseTimestamps?: Record<string, string> | null;

  @ApiPropertyOptional()
  queueJobId?: string | null;

  @ApiPropertyOptional()
  queuedAt?: Date | null;

  @ApiPropertyOptional()
  enqueuedAt?: Date | null;

  @ApiPropertyOptional()
  claimedAt?: Date | null;

  @ApiPropertyOptional()
  cancellationRequestedAt?: Date | null;

  @ApiPropertyOptional()
  cancelRequestedAt?: Date | null;

  @ApiPropertyOptional()
  cancelRequestedBy?: string | null;

  @ApiPropertyOptional()
  cancellationReason?: string | null;

  @ApiPropertyOptional()
  runnerId?: string | null;

  @ApiPropertyOptional()
  leaseAcquiredAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Current execution lease expiration; stale leases are failed by recovery.',
  })
  leaseExpiresAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Last persisted worker heartbeat for the execution lease owner.',
  })
  heartbeatAt?: Date | null;

  @ApiProperty({
    description: 'Number of worker claims for this immutable run. Jobs are fail-fast by default.',
  })
  attempt!: number;

  @ApiPropertyOptional()
  cleanupError?: string | null;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  finishedAt?: Date | null;

  @ApiProperty()
  totalTests!: number;

  @ApiProperty()
  passedTests!: number;

  @ApiProperty()
  failedTests!: number;

  @ApiPropertyOptional()
  durationMs?: number | null;

  @ApiPropertyOptional()
  errorMessage?: string | null;
}
