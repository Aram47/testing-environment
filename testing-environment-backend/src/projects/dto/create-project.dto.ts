import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  baseUrl: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mainServiceName: string;

  @ApiProperty({ default: '/health' })
  @IsString()
  @IsNotEmpty()
  healthcheckPath: string;

  @ApiProperty({ default: 200 })
  @IsInt()
  @Min(100)
  @Max(599)
  healthcheckExpectedStatus: number;

  @ApiProperty({ default: 60 })
  @IsInt()
  @Min(1)
  @Max(600)
  healthcheckTimeoutSeconds: number;
}
