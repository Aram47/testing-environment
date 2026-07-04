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
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CompileFlowDto } from './dto/compile-flow.dto';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { TestSuitesService } from './test-suites.service';

@ApiTags('Test suites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/test-suites')
export class TestSuitesController {
  constructor(private readonly service: TestSuitesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestSuiteDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.list(projectId, user.companyId, query);
  }

  @Post('compile-flow')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  compileFlow(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileFlowDto,
  ) {
    return this.service.compileFlow(projectId, user.companyId, dto.visualFlow);
  }

  @Get(':suiteId/revisions')
  revisions(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listRevisions(projectId, suiteId, user.companyId);
  }

  @Get(':suiteId/revisions/compare')
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  publishRevision(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publishRevision(projectId, suiteId, user.companyId, user.id, revisionId);
  }

  @Get(':suiteId')
  find(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.find(projectId, suiteId, user.companyId);
  }

  @Patch(':suiteId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  update(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestSuiteDto,
  ) {
    return this.service.update(projectId, suiteId, user.companyId, user.id, dto);
  }

  @Delete(':suiteId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  delete(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.delete(projectId, suiteId, user.companyId);
  }
}
