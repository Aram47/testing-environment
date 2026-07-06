import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuditService } from './audit.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
import { PaginatedAuditEventsResponseDto } from './dto/paginated-audit-events-response.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit:read', 'company')
  @ApiOkResponse({ type: PaginatedAuditEventsResponseDto })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: AuditEventsQueryDto) {
    return this.audit.list(user.companyId, query);
  }
}
