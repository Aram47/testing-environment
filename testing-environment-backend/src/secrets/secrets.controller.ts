import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretResponseDto } from './dto/secret-response.dto';
import { SecretsService } from './secrets.service';

@ApiTags('Secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/secrets')
export class SecretsController {
  constructor(private readonly service: SecretsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiCreatedResponse({ type: SecretResponseDto })
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSecretDto,
  ) {
    return this.service.create(projectId, user.companyId, user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: SecretResponseDto, isArray: true })
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(projectId, user.companyId);
  }

  @Delete(':secretId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  delete(
    @Param('projectId') projectId: string,
    @Param('secretId') secretId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.delete(projectId, secretId, user.companyId, user.id);
  }
}
