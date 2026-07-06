import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { TestSuiteResponseDto } from './test-suite-response.dto';

export class PaginatedTestSuitesResponseDto {
  @ApiProperty({ type: [TestSuiteResponseDto] })
  data!: TestSuiteResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
