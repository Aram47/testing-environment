import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentDryRunFailureCategory, EnvironmentDryRunStatus, RunnerLogSource } from '@prisma/client';
import { EnvironmentConfigRevisionResponseDto } from './environment-config-revision-response.dto';

export class EnvironmentDryRunLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dryRunId!: string;

  @ApiProperty({ enum: RunnerLogSource })
  source!: RunnerLogSource;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class EnvironmentDryRunResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  environmentConfigRevisionId!: string;

  @ApiProperty({ enum: EnvironmentDryRunStatus })
  status!: EnvironmentDryRunStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  queueJobId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  runnerVersion?: string | null;

  @ApiPropertyOptional({ enum: EnvironmentDryRunFailureCategory, nullable: true })
  failureCategory?: EnvironmentDryRunFailureCategory | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorMessage?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finishedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  cancelRequestedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: EnvironmentConfigRevisionResponseDto })
  environmentConfigRevision?: EnvironmentConfigRevisionResponseDto;

  @ApiPropertyOptional({ type: [EnvironmentDryRunLogResponseDto] })
  logs?: EnvironmentDryRunLogResponseDto[];
}
