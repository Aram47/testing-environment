import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyMemberStatus, UserRole } from '@prisma/client';

export class TeamMemberUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class TeamMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: CompanyMemberStatus })
  status!: CompanyMemberStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  removedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: TeamMemberUserDto })
  user!: TeamMemberUserDto;
}
