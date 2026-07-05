import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueCoreModule } from '../queue/queue-core.module';
import { ArtifactLogWriterService } from './artifact-log-writer.service';
import { ArtifactRetentionProcessor } from './artifact-retention.processor';
import { ArtifactRetentionService } from './artifact-retention.service';
import { ARTIFACT_STORAGE } from './artifact-storage.interface';
import { ArtifactsService } from './artifacts.service';
import { FilesystemArtifactStorage } from './filesystem-artifact-storage.service';
import { ReportArtifactService } from './report-artifact.service';

@Module({
  imports: [PrismaModule, QueueCoreModule],
  providers: [
    ArtifactsService,
    ArtifactLogWriterService,
    ReportArtifactService,
    ArtifactRetentionService,
    ArtifactRetentionProcessor,
    {
      provide: ARTIFACT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('ARTIFACT_STORAGE_DRIVER', 'filesystem');
        if (driver !== 'filesystem') {
          throw new Error(`Unsupported artifact storage driver: ${driver}`);
        }
        return new FilesystemArtifactStorage(config);
      },
    },
  ],
  exports: [ArtifactsService, ArtifactLogWriterService, ReportArtifactService],
})
export class ArtifactsModule {}
