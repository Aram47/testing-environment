import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { SecretRotationJobResponseDto } from './dto/secret-response.dto';
import { SecretRotationService } from './secret-rotation.service';

@ApiTags('Secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('secrets/key-rotations')
export class SecretRotationsController {
  constructor(private readonly rotation: SecretRotationService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiCreatedResponse({ type: SecretRotationJobResponseDto })
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.rotation.enqueue(user.companyId, user.id);
  }
}
