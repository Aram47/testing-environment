import { ApiProperty } from '@nestjs/swagger';
import { SecretRotationJobStatus } from '@prisma/client';

export class SecretResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  encryptionKeyVersion: string;

  @ApiProperty({ required: false, nullable: true })
  lastUsedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  createdById?: string | null;

  @ApiProperty({ required: false, nullable: true })
  rotatedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SecretRotationJobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SecretRotationJobStatus })
  status: SecretRotationJobStatus;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  fromKeyVersion: string;

  @ApiProperty()
  toKeyVersion: string;

  @ApiProperty()
  totalSecrets: number;

  @ApiProperty()
  processedSecrets: number;

  @ApiProperty({ required: false, nullable: true })
  lastProcessedSecretId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  errorMessage?: string | null;
}
