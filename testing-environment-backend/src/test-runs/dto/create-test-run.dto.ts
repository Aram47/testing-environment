import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateTestRunDto {
  @ApiPropertyOptional({
    description:
      'Explicit environment revision to run against. Defaults to latest published revision.',
  })
  @IsOptional()
  @IsUUID()
  environmentConfigRevisionId?: string;
}
