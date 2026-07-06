import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class ImportComposeDto {
  @ApiProperty()
  @IsString()
  composeYaml: string;

  @ApiProperty({ enum: ['paste', 'upload'] })
  @IsIn(['paste', 'upload'])
  source: 'paste' | 'upload';
}
