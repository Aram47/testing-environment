import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { OnboardingStep } from '../onboarding.types';

export class UpdateOnboardingSessionDto {
  @ApiPropertyOptional({ enum: ['project', 'environment', 'api-import', 'template', 'run'] })
  @IsOptional()
  @IsIn(['project', 'environment', 'api-import', 'template', 'run'])
  currentStep?: OnboardingStep;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  draftData?: Record<string, unknown>;
}
