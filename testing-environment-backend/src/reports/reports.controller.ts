import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
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
}
