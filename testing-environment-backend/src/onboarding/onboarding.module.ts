import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingCoreModule } from './onboarding-core.module';

@Module({
  imports: [OnboardingCoreModule],
  controllers: [OnboardingController],
  exports: [OnboardingCoreModule],
})
export class OnboardingModule {}
