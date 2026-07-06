import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UpsertEnvironmentConfigDto } from './dto/upsert-environment-config.dto';
import { CompileEnvironmentConfigDto } from './dto/compile-environment-config.dto';
import { CreateEnvironmentDryRunDto } from './dto/create-environment-dry-run.dto';
import { ImportComposeDto } from './dto/import-compose.dto';
import { PreflightEnvironmentConfigDto } from './dto/preflight-environment-config.dto';
import { EnvironmentConfigsService } from './environment-configs.service';
import { EnvironmentDryRunsService } from './environment-dry-runs.service';
import { EnvironmentPreflightService } from './environment-preflight.service';

@ApiTags('Environment configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/environment-config')
export class EnvironmentConfigsController {
  constructor(
    private readonly service: EnvironmentConfigsService,
    private readonly preflight: EnvironmentPreflightService,
    private readonly dryRuns: EnvironmentDryRunsService,
  ) {}

  @Post()
  @RequirePermission('environment:write', 'environment')
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEnvironmentConfigDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  @RequirePermission('environment:read', 'environment')
  find(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.find(projectId, user.companyId);
  }

  @Post('compile')
  @RequirePermission('environment:write', 'environment')
  compile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileEnvironmentConfigDto,
  ) {
    return this.service.compile(projectId, user.companyId, dto.visualConfig);
  }

  @Post('preflight')
  @RequirePermission('environment:read', 'environment')
  runPreflight(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreflightEnvironmentConfigDto,
  ) {
    return this.preflight.preflight(projectId, user.companyId, dto);
  }

  @Post('import-compose')
  @RequirePermission('environment:write', 'environment')
  importCompose(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportComposeDto,
  ) {
    return this.service.importCompose(projectId, user.companyId, dto);
  }

  @Post('dry-runs')
  @RequirePermission('environment:write', 'environment')
  createDryRun(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnvironmentDryRunDto,
  ) {
    return this.dryRuns.create(projectId, user.companyId, dto);
  }

  @Get('dry-runs')
  @RequirePermission('environment:read', 'environment')
  listDryRuns(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dryRuns.list(projectId, user.companyId, query);
  }

  @Get('dry-runs/:dryRunId')
  @RequirePermission('environment:read', 'environment')
  getDryRun(
    @Param('projectId') projectId: string,
    @Param('dryRunId') dryRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dryRuns.find(projectId, user.companyId, dryRunId);
  }

  @Post('dry-runs/:dryRunId/cancel')
  @RequirePermission('environment:write', 'environment')
  cancelDryRun(
    @Param('projectId') projectId: string,
    @Param('dryRunId') dryRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dryRuns.cancel(projectId, user.companyId, dryRunId);
  }

  @Get('revisions')
  @RequirePermission('environment:read', 'environment')
  revisions(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRevisions(projectId, user.companyId);
  }

  @Get('revisions/compare')
  @RequirePermission('environment:read', 'environment')
  compareRevisions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.compareRevisions(projectId, user.companyId, from, to);
  }

  @Get('revisions/:revisionId')
  @RequirePermission('environment:read', 'environment')
  getRevision(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getRevision(projectId, user.companyId, revisionId);
  }

  @Post('revisions/:revisionId/publish')
  @RequirePermission('environment:write', 'revision')
  publishRevision(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publishRevision(projectId, user.companyId, user.id, revisionId);
  }

  @Patch()
  @RequirePermission('environment:write', 'environment')
  update(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEnvironmentConfigDto,
  ) {
    return this.service.update(projectId, user.companyId, user.id, dto);
  }
}
