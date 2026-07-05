import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ApiTokensService } from './api-tokens.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

@ApiTags('API tokens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api-tokens')
export class ApiTokensController {
  constructor(private readonly apiTokens: ApiTokensService) {}

  @Get()
  @RequirePermission('token:manage', 'company')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiTokens.list(user.companyId);
  }

  @Post()
  @RequirePermission('token:manage', 'company')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiTokenDto) {
    return this.apiTokens.create(user.companyId, user, dto);
  }

  @Delete(':tokenId')
  @RequirePermission('token:manage', 'company')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('tokenId') tokenId: string) {
    return this.apiTokens.revoke(user.companyId, tokenId, user);
  }
}
