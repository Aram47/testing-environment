import { ApiProperty } from '@nestjs/swagger';
import { EnvironmentConfigType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpsertEnvironmentConfigDto {
  @ApiProperty({ enum: EnvironmentConfigType, default: EnvironmentConfigType.DOCKER_COMPOSE })
  @IsEnum(EnvironmentConfigType)
  type: EnvironmentConfigType = EnvironmentConfigType.DOCKER_COMPOSE;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  composeYaml: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  backendTestYaml: string;
}
