import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsCoreModule } from './subscriptions-core.module';

@Module({
  imports: [SubscriptionsCoreModule],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsCoreModule],
})
export class SubscriptionsModule {}
