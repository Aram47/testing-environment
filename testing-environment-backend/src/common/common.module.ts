import { Global, Module } from '@nestjs/common';
import { ProjectAccessService } from './services/project-access.service';

@Global()
@Module({
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class CommonModule {}
