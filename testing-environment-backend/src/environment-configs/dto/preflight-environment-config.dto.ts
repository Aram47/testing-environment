import { ApiProperty } from '@nestjs/swagger';
import { EnvironmentConfigType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { EnvironmentVisualConfig } from '../types/environment-visual-config.types';

export class PreflightEnvironmentConfigDto {
  @ApiProperty({ enum: EnvironmentConfigType, required: false })
  @IsOptional()
  @IsEnum(EnvironmentConfigType)
  type?: EnvironmentConfigType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  composeYaml?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  backendTestYaml?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  visualConfig?: EnvironmentVisualConfig;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  revisionId?: string;
}
