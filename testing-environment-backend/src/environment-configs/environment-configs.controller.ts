import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CompileEnvironmentConfigDto } from './dto/compile-environment-config.dto';
import { UpsertEnvironmentConfigDto } from './dto/upsert-environment-config.dto';
import { EnvironmentConfigsService } from './environment-configs.service';

@ApiTags('Environment configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/environment-config')
export class EnvironmentConfigsController {
  constructor(private readonly service: EnvironmentConfigsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEnvironmentConfigDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  find(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.find(projectId, user.companyId);
  }

  @Post('compile')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  compile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileEnvironmentConfigDto,
  ) {
    return this.service.compile(projectId, user.companyId, dto.visualConfig);
  }

  @Get('revisions')
  revisions(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRevisions(projectId, user.companyId);
  }

  @Get('revisions/compare')
  compareRevisions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.compareRevisions(projectId, user.companyId, from, to);
  }

  @Post('revisions/:revisionId/publish')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  publishRevision(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publishRevision(projectId, user.companyId, user.id, revisionId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  update(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEnvironmentConfigDto,
  ) {
    return this.service.update(projectId, user.companyId, user.id, dto);
  }
}
