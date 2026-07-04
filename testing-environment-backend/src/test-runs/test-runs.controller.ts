import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TestRunResponseDto } from './dto/test-run-response.dto';
import { TestRunsService } from './test-runs.service';

@ApiTags('Test runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/test-runs')
export class TestRunsController {
  constructor(private readonly service: TestRunsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiCreatedResponse({ type: TestRunResponseDto })
  create(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(projectId, user.companyId);
  }

  @Get()
  @ApiOkResponse({ type: TestRunResponseDto, isArray: true })
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.list(projectId, user.companyId, query);
  }

  @Get(':runId')
  @ApiOkResponse({ type: TestRunResponseDto })
  find(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.find(projectId, runId, user.companyId);
  }

  @Post(':runId/cancel')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiOkResponse({ type: TestRunResponseDto })
  cancel(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(projectId, runId, user.companyId);
  }
}
