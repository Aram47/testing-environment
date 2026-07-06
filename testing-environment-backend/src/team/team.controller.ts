import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TeamMemberResponseDto } from './dto/team-member-response.dto';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TeamService } from './team.service';

@ApiTags('Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('team/members')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @RequirePermission('team:manage', 'company')
  @ApiOkResponse({ type: TeamMemberResponseDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.team.list(user.companyId);
  }

  @Patch(':memberId')
  @RequirePermission('team:manage', 'company')
  @ApiOkResponse({ type: TeamMemberResponseDto })
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.team.updateRole(user.companyId, memberId, dto.role, user);
  }

  @Delete(':memberId')
  @RequirePermission('team:manage', 'company')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('memberId') memberId: string) {
    return this.team.remove(user.companyId, memberId, user);
  }
}
