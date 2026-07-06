import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesCoreModule } from './companies-core.module';

@Module({
  imports: [CompaniesCoreModule],
  controllers: [CompaniesController],
  exports: [CompaniesCoreModule],
})
export class CompaniesModule {}
