import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';

export class TestRunResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  environmentConfigRevisionId?: string | null;

  @ApiProperty()
  runnerVersion!: string;

  @ApiProperty()
  reportSchemaVersion!: number;

  @ApiProperty({ enum: TestRunStatus })
  status!: TestRunStatus;

  @ApiPropertyOptional({
    description: 'Human-readable terminal or cancellation reason for the current run state.',
    type: String,
    nullable: true,
  })
  statusReason?: string | null;

  @ApiPropertyOptional({ enum: TestRunFailureCategory, nullable: true })
  failureCategory?: TestRunFailureCategory | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  currentPhase?: string | null;

  @ApiPropertyOptional({ type: Object })
  phaseTimestamps?: Record<string, string> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  queueJobId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  queuedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  enqueuedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  claimedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  cancellationRequestedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  cancelRequestedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cancelRequestedBy?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cancellationReason?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  runnerId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  leaseAcquiredAt?: string | null;

  @ApiPropertyOptional({
    description: 'Current execution lease expiration; stale leases are failed by recovery.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  leaseExpiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Last persisted worker heartbeat for the execution lease owner.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  heartbeatAt?: string | null;

  @ApiProperty({
    description: 'Number of worker claims for this immutable run. Jobs are fail-fast by default.',
  })
  attempt!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  cleanupError?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finishedAt?: string | null;

  @ApiProperty()
  totalTests!: number;

  @ApiProperty()
  passedTests!: number;

  @ApiProperty()
  failedTests!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationMs?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorMessage?: string | null;
}
