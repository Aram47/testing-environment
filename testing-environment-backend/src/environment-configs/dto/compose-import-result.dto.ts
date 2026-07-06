import { ApiProperty } from '@nestjs/swagger';

export class ComposeImportResultDto {
  @ApiProperty({ type: Object })
  visualConfig!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  analysis!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  importWarnings!: string[];

  @ApiProperty({ type: [String] })
  unsupportedFields!: string[];
}
