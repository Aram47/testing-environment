import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { SecretRotationJobResponseDto } from './dto/secret-response.dto';
import { SecretRotationService } from './secret-rotation.service';

@ApiTags('Secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('secrets/key-rotations')
export class SecretRotationsController {
  constructor(private readonly rotation: SecretRotationService) {}

  @Post()
  @RequirePermission('secret:write', 'company')
  @ApiCreatedResponse({ type: SecretRotationJobResponseDto })
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.rotation.enqueue(user.companyId, user.id);
  }
}
