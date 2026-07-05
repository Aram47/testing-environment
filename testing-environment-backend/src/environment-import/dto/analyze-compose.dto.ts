import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { EnvironmentImportSource } from '../types/import-analysis.types';

export class AnalyzeComposeDto {
  @ApiProperty({ enum: ['UPLOAD', 'PASTE', 'TEMPLATE'] })
  @IsIn(['UPLOAD', 'PASTE', 'TEMPLATE'])
  source: Extract<EnvironmentImportSource, 'UPLOAD' | 'PASTE' | 'TEMPLATE'>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  composeYaml: string;
}
