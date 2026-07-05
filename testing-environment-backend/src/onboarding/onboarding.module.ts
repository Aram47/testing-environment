import { Module } from '@nestjs/common';
import { EnvironmentImportModule } from '../environment-import/environment-import.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingTemplatesService } from './onboarding-templates.service';

@Module({
  imports: [EnvironmentImportModule, SubscriptionsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingTemplatesService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
