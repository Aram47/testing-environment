import { ApiProperty } from '@nestjs/swagger';

export class TestRunEventResponseDto {
  @ApiProperty()
  runId!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ type: Object })
  payload!: unknown;
}
