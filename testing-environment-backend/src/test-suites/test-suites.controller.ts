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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CompileFlowDto } from './dto/compile-flow.dto';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { GenerateImportedFlowDto } from './dto/import/generate-imported-flow.dto';
import { ImportPreviewDto } from './dto/import/import-preview.dto';
import { PaginatedTestSuitesResponseDto } from './dto/paginated-test-suites-response.dto';
import { TestSuiteResponseDto } from './dto/test-suite-response.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { ApiImportService } from './import/api-import.service';
import { TestSuitesService } from './test-suites.service';

@ApiTags('Test suites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/test-suites')
export class TestSuitesController {
  constructor(
    private readonly service: TestSuitesService,
    private readonly importService: ApiImportService,
  ) {}

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
  @ApiOkResponse({ type: PaginatedTestSuitesResponseDto })
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

  @Post('import/preview')
  @RequirePermission('suite:write', 'project')
  previewImport(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportPreviewDto,
  ) {
    return this.importService.preview(projectId, user.companyId, dto);
  }

  @Post('import/generate-flow')
  @RequirePermission('suite:write', 'project')
  generateImportedFlow(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateImportedFlowDto,
  ) {
    return this.importService.generateFlow(projectId, user.companyId, dto);
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
  @ApiOkResponse({ type: TestSuiteResponseDto })
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
