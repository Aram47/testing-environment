import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiTokenResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [String] })
  scopes!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  projectId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  revokedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class CreateApiTokenResponseDto extends ApiTokenResponseDto {
  @ApiProperty({ description: 'Plaintext token shown once at creation time.' })
  token!: string;
}
