import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentConfigType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OnboardingProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  baseUrl: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mainServiceName: string;

  @ApiProperty({ default: '/health' })
  @IsString()
  @IsNotEmpty()
  healthcheckPath: string;

  @ApiProperty({ default: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  healthcheckExpectedStatus: number;

  @ApiProperty({ default: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  healthcheckTimeoutSeconds: number;
}

export class ConfirmOnboardingDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => OnboardingProjectDto)
  project: OnboardingProjectDto;

  @ApiProperty({ enum: EnvironmentConfigType })
  @IsEnum(EnvironmentConfigType)
  environmentType: EnvironmentConfigType;

  @ApiPropertyOptional({
    description: 'Required when environmentType is DOCKER_COMPOSE',
  })
  @IsOptional()
  @IsString()
  composeYaml?: string;

  @ApiProperty({ description: 'backend-test runtime YAML configuration' })
  @IsString()
  @IsNotEmpty()
  backendTestYaml: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  analysis?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;
}
