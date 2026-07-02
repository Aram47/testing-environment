import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { FlowSuiteDefinition } from '../types/flow-suite.types';

export class CompileFlowDto {
  @ApiProperty()
  @IsObject()
  visualFlow: FlowSuiteDefinition;
}
