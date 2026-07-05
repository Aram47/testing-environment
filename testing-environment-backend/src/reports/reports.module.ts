import { Module } from '@nestjs/common';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ArtifactsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
