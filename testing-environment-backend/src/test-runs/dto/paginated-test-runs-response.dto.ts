import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { TestRunResponseDto } from '../../test-runs/dto/test-run-response.dto';

export class PaginatedTestRunsResponseDto {
  @ApiProperty({ type: [TestRunResponseDto] })
  data!: TestRunResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
