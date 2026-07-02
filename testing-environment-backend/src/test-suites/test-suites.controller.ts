import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  create(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTestSuiteDto) {
    return this.service.create(projectId, user.companyId, dto);
  }

  @Get()
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
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

  @Get(':suiteId')
  find(@Param('projectId') projectId: string, @Param('suiteId') suiteId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.find(projectId, suiteId, user.companyId);
  }

  @Patch(':suiteId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  update(@Param('projectId') projectId: string, @Param('suiteId') suiteId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTestSuiteDto) {
    return this.service.update(projectId, suiteId, user.companyId, dto);
  }

  @Delete(':suiteId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER)
  delete(@Param('projectId') projectId: string, @Param('suiteId') suiteId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.delete(projectId, suiteId, user.companyId);
  }
}
