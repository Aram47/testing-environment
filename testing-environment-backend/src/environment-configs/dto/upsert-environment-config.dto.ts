import { ApiProperty } from '@nestjs/swagger';
import { EnvironmentConfigType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EnvironmentVisualConfig } from '../types/environment-visual-config.types';

export class UpsertEnvironmentConfigDto {
  @ApiProperty({ enum: EnvironmentConfigType, default: EnvironmentConfigType.DOCKER_COMPOSE })
  @IsEnum(EnvironmentConfigType)
  type: EnvironmentConfigType = EnvironmentConfigType.DOCKER_COMPOSE;

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
}
