import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { AuditEventResponseDto } from './audit-event-response.dto';

export class PaginatedAuditEventsResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] })
  data!: AuditEventResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
