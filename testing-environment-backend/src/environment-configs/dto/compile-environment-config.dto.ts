import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { EnvironmentVisualConfig } from '../types/environment-visual-config.types';

export class CompileEnvironmentConfigDto {
  @ApiProperty()
  @IsObject()
  visualConfig: EnvironmentVisualConfig;
}
