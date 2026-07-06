import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnvironmentDryRunDto {
  @ApiProperty()
  @IsUUID()
  revisionId: string;
}
