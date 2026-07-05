import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiImportSourceType, ManualImportRequest } from '../../types/api-import.types';

export class ImportPreviewDto {
  @ApiProperty({ enum: ['OPENAPI', 'POSTMAN', 'BRUNO', 'CURL', 'MANUAL'] })
  @IsIn(['OPENAPI', 'POSTMAN', 'BRUNO', 'CURL', 'MANUAL'])
  sourceType: ApiImportSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024 * 1024)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  files?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  manualRequest?: ManualImportRequest;
}
