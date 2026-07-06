import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/test-runs/:runId')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('report')
  @ApiProduces('application/json')
  @ApiOkResponse({ description: 'Test run report JSON file.' })
  @RequirePermission('run:read', 'run')
  report(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.report(projectId, runId, user.companyId);
  }

  @Get('logs')
  @RequirePermission('run:read', 'run')
  logs(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.logs(projectId, runId, user.companyId);
  }

  @Get('logs/chunks')
  @RequirePermission('run:read', 'run')
  @ApiOkResponse({ description: 'Paginated persisted log chunks for a test run.' })
  logChunks(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.logChunks(projectId, runId, user.companyId, query);
  }

  @Get('report/junit')
  @Header('content-type', 'application/xml')
  @ApiProduces('application/xml')
  @ApiOkResponse({ description: 'JUnit XML report file.' })
  @RequirePermission('run:read', 'run')
  junit(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.junit(projectId, runId, user.companyId);
  }

  @Get('artifacts/:artifactId/download')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Downloadable test run artifact.' })
  @RequirePermission('run:read', 'run')
  async downloadArtifact(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('artifactId') artifactId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const artifact = await this.service.downloadArtifact(
      projectId,
      runId,
      artifactId,
      user.companyId,
    );
    response.setHeader('content-type', artifact.mimeType);
    response.setHeader('content-disposition', `attachment; filename="${artifact.fileName}"`);
    return new StreamableFile(artifact.buffer);
  }
}
