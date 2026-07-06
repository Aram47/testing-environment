import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  action!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  companyId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  projectId?: string | null;

  @ApiProperty()
  actorType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  actorUserId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  serviceAccountId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiTokenId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  resourceType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  resourceId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  requestId?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
