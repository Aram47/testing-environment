import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentConfigType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingProjectDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  baseUrl: string;

  @ApiProperty()
  @IsString()
  mainServiceName: string;

  @ApiProperty()
  @IsString()
  healthcheckPath: string;

  @ApiProperty()
  healthcheckExpectedStatus: number;

  @ApiProperty()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  composeYaml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  backendTestYaml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  analysis?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;
}
