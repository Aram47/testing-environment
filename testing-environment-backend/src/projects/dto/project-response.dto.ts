import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty()
  baseUrl!: string;

  @ApiProperty()
  mainServiceName!: string;

  @ApiProperty()
  healthcheckPath!: string;

  @ApiProperty()
  healthcheckExpectedStatus!: number;

  @ApiProperty()
  healthcheckTimeoutSeconds!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
