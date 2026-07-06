import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { EnvironmentDryRunResponseDto } from './environment-dry-run-response.dto';

export class PaginatedEnvironmentDryRunsResponseDto {
  @ApiProperty({ type: [EnvironmentDryRunResponseDto] })
  data!: EnvironmentDryRunResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
