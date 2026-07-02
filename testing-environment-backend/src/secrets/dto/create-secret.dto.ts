import { ApiProperty } from '@nestjs/swagger';
import { Matches, MinLength } from 'class-validator';

export class CreateSecretDto {
  @ApiProperty()
  @Matches(/^[A-Z0-9_]{2,80}$/)
  key: string;

  @ApiProperty({ minLength: 1 })
  @MinLength(1)
  value: string;
}
