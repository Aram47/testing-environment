import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlanName } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @ApiProperty({ enum: SubscriptionPlanName })
  @IsEnum(SubscriptionPlanName)
  planName: SubscriptionPlanName;
}
