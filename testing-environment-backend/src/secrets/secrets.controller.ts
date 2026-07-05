import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretResponseDto } from './dto/secret-response.dto';
import { SecretsService } from './secrets.service';

@ApiTags('Secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/secrets')
export class SecretsController {
  constructor(private readonly service: SecretsService) {}

  @Post()
  @RequirePermission('secret:write', 'project')
  @ApiCreatedResponse({ type: SecretResponseDto })
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSecretDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  @RequirePermission('secret:read', 'project')
  @ApiOkResponse({ type: SecretResponseDto, isArray: true })
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(projectId, user.companyId);
  }

  @Delete(':secretId')
  @RequirePermission('secret:write', 'secret')
  delete(
    @Param('projectId') projectId: string,
    @Param('secretId') secretId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.delete(projectId, secretId, user.companyId, user.id);
  }
}
