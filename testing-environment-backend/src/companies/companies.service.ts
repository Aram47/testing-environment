import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  getMe(companyId: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { subscriptionPlan: true },
    });
  }

  updateMe(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: dto,
      include: { subscriptionPlan: true },
    });
  }
}
