import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { TestSuiteSourceMode } from '../types/execution-plan.types';
import { FlowSuiteDefinition } from '../types/flow-suite.types';

export class CreateTestSuiteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  yamlContent?: string;

  @ApiProperty({ enum: ['VISUAL', 'RAW_YAML'], required: false })
  @IsOptional()
  @IsIn(['VISUAL', 'RAW_YAML'])
  sourceMode?: TestSuiteSourceMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  visualFlow?: FlowSuiteDefinition;
}
