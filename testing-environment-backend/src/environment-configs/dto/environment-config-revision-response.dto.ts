import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RevisionStatus } from '@prisma/client';

export class EnvironmentConfigRevisionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  environmentConfigId!: string;

  @ApiProperty()
  revisionNumber!: number;

  @ApiProperty({ enum: RevisionStatus })
  status!: RevisionStatus;

  @ApiProperty()
  sourceMode!: string;

  @ApiPropertyOptional({ type: Object })
  visualConfig?: Record<string, unknown> | null;

  @ApiProperty()
  compiledComposeYaml!: string;

  @ApiProperty()
  compiledRuntimeYaml!: string;

  @ApiProperty()
  schemaVersion!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  createdById?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  publishedById?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
