import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getMe(user.companyId);
  }

  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMe(user.companyId, dto);
  }
}
