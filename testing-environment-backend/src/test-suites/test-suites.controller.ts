import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CompileFlowDto } from './dto/compile-flow.dto';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { TestSuitesService } from './test-suites.service';

@ApiTags('Test suites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/test-suites')
export class TestSuitesController {
  constructor(private readonly service: TestSuitesService) {}

  @Post()
  @RequirePermission('suite:write', 'project')
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestSuiteDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  @RequirePermission('suite:read', 'project')
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.list(projectId, user.companyId, query);
  }

  @Post('compile-flow')
  @RequirePermission('suite:write', 'project')
  compileFlow(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileFlowDto,
  ) {
    return this.service.compileFlow(projectId, user.companyId, dto.visualFlow);
  }

  @Get(':suiteId/revisions')
  @RequirePermission('suite:read', 'suite')
  revisions(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listRevisions(projectId, suiteId, user.companyId);
  }

  @Get(':suiteId/revisions/compare')
  @RequirePermission('suite:read', 'suite')
  compareRevisions(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.compareRevisions(projectId, suiteId, user.companyId, from, to);
  }

  @Post(':suiteId/revisions/:revisionId/publish')
  @RequirePermission('suite:write', 'revision')
  publishRevision(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publishRevision(projectId, suiteId, user.companyId, user.id, revisionId);
  }

  @Get(':suiteId')
  @RequirePermission('suite:read', 'suite')
  find(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.find(projectId, suiteId, user.companyId);
  }

  @Patch(':suiteId')
  @RequirePermission('suite:write', 'suite')
  update(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestSuiteDto,
  ) {
    return this.service.update(projectId, suiteId, user.companyId, user.id, dto);
  }

  @Delete(':suiteId')
  @RequirePermission('suite:write', 'suite')
  delete(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.delete(projectId, suiteId, user.companyId);
  }
}
