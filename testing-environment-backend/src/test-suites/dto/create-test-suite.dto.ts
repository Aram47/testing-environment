import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  visualFlow?: FlowSuiteDefinition;
}
