import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestRunFailureCategory } from '@prisma/client';
import { TestRunResponseDto } from './test-run-response.dto';

export class AssertionResultDto {
  @ApiProperty()
  fieldPath!: string;

  @ApiProperty()
  operator!: string;

  @ApiPropertyOptional()
  expected?: unknown;

  @ApiPropertyOptional()
  actual?: unknown;

  @ApiProperty()
  passed!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;
}

export class PrimaryFailureDto {
  @ApiProperty({
    enum: ['test_step', 'environment', 'healthcheck', 'infrastructure', 'cancelled'],
  })
  kind!: 'test_step' | 'environment' | 'healthcheck' | 'infrastructure' | 'cancelled';

  @ApiProperty()
  phase!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  testResultId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  stepId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  suiteName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  testName?: string | null;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  expected?: unknown;

  @ApiPropertyOptional()
  actual?: unknown;

  @ApiPropertyOptional({ type: AssertionResultDto, isArray: true })
  assertions?: AssertionResultDto[];
}

export class EnvironmentResultDto {
  @ApiProperty({ enum: ['passed', 'failed', 'skipped', 'not_reached'] })
  status!: 'passed' | 'failed' | 'skipped' | 'not_reached';

  @ApiPropertyOptional()
  validationPassed?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;
}

export class HealthcheckResultDto {
  @ApiProperty({ enum: ['passed', 'failed', 'skipped', 'not_reached'] })
  status!: 'passed' | 'failed' | 'skipped' | 'not_reached';

  @ApiPropertyOptional()
  expectedStatus?: number;

  @ApiPropertyOptional()
  actualStatus?: number;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;
}

export class InfrastructureDiagnosticsDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  cleanupError?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  runnerId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorMessage?: string | null;
}

export class TestRunDiagnosisDto {
  @ApiPropertyOptional({ enum: TestRunFailureCategory, nullable: true })
  failureCategory?: TestRunFailureCategory | null;

  @ApiProperty()
  headline!: string;

  @ApiPropertyOptional({ type: PrimaryFailureDto, nullable: true })
  primaryFailure?: PrimaryFailureDto | null;

  @ApiProperty({ type: EnvironmentResultDto })
  environmentResult!: EnvironmentResultDto;

  @ApiProperty({ type: HealthcheckResultDto })
  healthcheckResult!: HealthcheckResultDto;

  @ApiProperty({ type: InfrastructureDiagnosticsDto })
  infrastructure!: InfrastructureDiagnosticsDto;
}

export class PhaseTimelineEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: ['pending', 'active', 'completed', 'failed', 'skipped'] })
  status!: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finishedAt?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationMs?: number | null;
}

export class TestResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  stepId?: string | null;

  @ApiProperty()
  stepType!: string;

  @ApiProperty()
  suiteName!: string;

  @ApiProperty()
  testName!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  expectedStatus!: number;

  @ApiPropertyOptional()
  actualStatus?: number;

  @ApiProperty()
  attempts!: number;

  @ApiProperty()
  durationMs!: number;

  @ApiPropertyOptional()
  requestBody?: unknown;

  @ApiPropertyOptional()
  responsePreview?: unknown;

  @ApiPropertyOptional()
  responsePreviewTruncated?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  responseArtifactId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorMessage?: string | null;

  @ApiPropertyOptional({ type: AssertionResultDto, isArray: true })
  assertionResults?: AssertionResultDto[];

  @ApiPropertyOptional()
  variablesSnapshot?: unknown;

  @ApiPropertyOptional()
  requestHeaders?: unknown;

  @ApiPropertyOptional()
  responseHeaders?: unknown;

  @ApiProperty()
  createdAt!: string;
}

export class TestRunDetailResponseDto extends TestRunResponseDto {
  @ApiProperty({ type: TestResultResponseDto, isArray: true })
  results!: TestResultResponseDto[];

  @ApiProperty({ type: TestRunDiagnosisDto })
  diagnosis!: TestRunDiagnosisDto;

  @ApiProperty({ type: PhaseTimelineEntryDto, isArray: true })
  phaseTimeline!: PhaseTimelineEntryDto[];

  @ApiPropertyOptional()
  environmentConfigRevision?: unknown;

  @ApiPropertyOptional({ type: Object, isArray: true })
  suiteRevisions?: unknown[];
}
