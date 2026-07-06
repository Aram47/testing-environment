import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiTokenResponseDto, CreateApiTokenResponseDto } from './dto/api-token-response.dto';
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
  @ApiOkResponse({ type: ApiTokenResponseDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiTokens.list(user.companyId);
  }

  @Post()
  @RequirePermission('token:manage', 'company')
  @ApiCreatedResponse({ type: CreateApiTokenResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiTokenDto) {
    return this.apiTokens.create(user.companyId, user, dto);
  }

  @Delete(':tokenId')
  @RequirePermission('token:manage', 'company')
  @ApiOkResponse({ type: ApiTokenResponseDto })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('tokenId') tokenId: string) {
    return this.apiTokens.revoke(user.companyId, tokenId, user);
  }
}
