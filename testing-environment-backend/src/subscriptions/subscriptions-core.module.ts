import { Module } from '@nestjs/common';
import { CompaniesCoreModule } from '../companies/companies-core.module';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [CompaniesCoreModule],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsCoreModule {}
