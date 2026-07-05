import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CancelTestRunDto } from './dto/cancel-test-run.dto';
import { TestRunResponseDto } from './dto/test-run-response.dto';
import { TestRunsService } from './test-runs.service';

@ApiTags('Test runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/test-runs')
export class TestRunsController {
  constructor(private readonly service: TestRunsService) {}

  @Post()
  @RequirePermission('run:write', 'project')
  @ApiCreatedResponse({ type: TestRunResponseDto })
  create(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(projectId, user.companyId);
  }

  @Get()
  @RequirePermission('run:read', 'project')
  @ApiOkResponse({ type: TestRunResponseDto, isArray: true })
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.list(projectId, user.companyId, query);
  }

  @Get(':runId')
  @RequirePermission('run:read', 'run')
  @ApiOkResponse({ type: TestRunResponseDto })
  find(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.find(projectId, runId, user.companyId);
  }

  @Post(':runId/cancel')
  @RequirePermission('run:write', 'run')
  @ApiOkResponse({ type: TestRunResponseDto })
  cancel(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CancelTestRunDto,
  ) {
    return this.service.cancel(projectId, runId, user.companyId, user.id, body?.reason);
  }
}
