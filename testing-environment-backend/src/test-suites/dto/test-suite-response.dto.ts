import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestSuiteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  deletedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional()
  yamlContent?: string;

  @ApiPropertyOptional({ type: Object })
  visualFlow?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  currentRevision?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  publishedRevision?: Record<string, unknown>;
}
