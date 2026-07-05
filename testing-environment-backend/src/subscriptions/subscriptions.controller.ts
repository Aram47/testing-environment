import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @RequirePermission('company:read', 'company')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Patch('current')
  @RequirePermission('billing:manage', 'company')
  changeCurrentPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.changePlan(user.companyId, dto.planName);
  }
}
