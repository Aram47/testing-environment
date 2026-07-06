import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestRunStatus } from '@prisma/client';

export class ComparisonRunRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TestRunStatus })
  status!: TestRunStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  finishedAt?: string | null;
}

export class RevisionComparisonDto {
  @ApiPropertyOptional()
  current?: unknown;

  @ApiPropertyOptional()
  baseline?: unknown;

  @ApiProperty()
  changed!: boolean;
}

export class SuiteRevisionComparisonDto {
  @ApiProperty()
  suiteName!: string;

  @ApiPropertyOptional()
  currentRevisionNumber?: number;

  @ApiPropertyOptional()
  baselineRevisionNumber?: number;

  @ApiProperty()
  changed!: boolean;
}

export class ImageReferenceComparisonDto {
  @ApiProperty()
  serviceName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  current?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  baseline?: string | null;

  @ApiProperty()
  changed!: boolean;
}

export class StepDiffDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  stepId?: string | null;

  @ApiProperty()
  testName!: string;

  @ApiPropertyOptional()
  currentStatus?: string;

  @ApiPropertyOptional()
  baselineStatus?: string;

  @ApiProperty()
  statusChanged!: boolean;

  @ApiPropertyOptional()
  currentActualStatus?: number;

  @ApiPropertyOptional()
  baselineActualStatus?: number;

  @ApiPropertyOptional()
  currentDurationMs?: number;

  @ApiPropertyOptional()
  baselineDurationMs?: number;

  @ApiPropertyOptional()
  durationRegressionMs?: number;

  @ApiPropertyOptional()
  durationRegressionPercent?: number;
}

export class ComparisonSummaryDto {
  @ApiProperty()
  stepsWithStatusChange!: number;

  @ApiProperty()
  stepsWithTimingRegression!: number;
}

export class TestRunComparisonDto {
  @ApiPropertyOptional({ type: ComparisonRunRefDto, nullable: true })
  baselineRun?: ComparisonRunRefDto | null;

  @ApiProperty({ type: ComparisonRunRefDto })
  currentRun!: ComparisonRunRefDto;

  @ApiProperty()
  revisions!: {
    environment: RevisionComparisonDto;
    suites: SuiteRevisionComparisonDto[];
  };

  @ApiProperty({ type: ImageReferenceComparisonDto, isArray: true })
  imageReferences!: ImageReferenceComparisonDto[];

  @ApiProperty({ type: StepDiffDto, isArray: true })
  stepDiffs!: StepDiffDto[];

  @ApiProperty({ type: ComparisonSummaryDto })
  summary!: ComparisonSummaryDto;
}
