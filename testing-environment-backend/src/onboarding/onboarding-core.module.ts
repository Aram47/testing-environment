import { Module } from '@nestjs/common';
import { EnvironmentImportModule } from '../environment-import/environment-import.module';
import { SubscriptionsCoreModule } from '../subscriptions/subscriptions-core.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingTemplatesService } from './onboarding-templates.service';

@Module({
  imports: [EnvironmentImportModule, SubscriptionsCoreModule],
  providers: [OnboardingService, OnboardingTemplatesService],
  exports: [OnboardingService, EnvironmentImportModule],
})
export class OnboardingCoreModule {}
