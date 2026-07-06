import { ApiProperty } from '@nestjs/swagger';

export class PreflightCheckDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['pass', 'warn', 'fail'] })
  status!: 'pass' | 'warn' | 'fail';

  @ApiProperty()
  message!: string;
}

export class EnvironmentResourceEstimationDto {
  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  tier!: 'low' | 'medium' | 'high';

  @ApiProperty()
  serviceCount!: number;

  @ApiProperty({ type: [String] })
  notes!: string[];
}

export class EnvironmentPreflightResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ type: [PreflightCheckDto] })
  checks!: PreflightCheckDto[];

  @ApiProperty({ type: [String] })
  securityErrors!: string[];

  @ApiProperty({ type: [String] })
  dependencyWarnings!: string[];

  @ApiProperty({ type: EnvironmentResourceEstimationDto })
  resourceEstimation!: EnvironmentResourceEstimationDto;
}
