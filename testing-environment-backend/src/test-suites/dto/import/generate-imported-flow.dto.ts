import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiImportTemplate, ImportedApiOperation } from '../../types/api-import.types';

export class GenerateImportedFlowDto {
  @ApiProperty()
  @IsString()
  suiteName: string;

  @ApiProperty({
    enum: [
      'SMOKE_TEST',
      'AUTHENTICATED_JOURNEY',
      'CRUD_LIFECYCLE',
      'ASYNC_POLLING',
      'READINESS_TEST',
    ],
  })
  @IsIn([
    'SMOKE_TEST',
    'AUTHENTICATED_JOURNEY',
    'CRUD_LIFECYCLE',
    'ASYNC_POLLING',
    'READINESS_TEST',
  ])
  template: ApiImportTemplate;

  @ApiProperty()
  @IsArray()
  operations: ImportedApiOperation[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acknowledgeDestructive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
