import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator'
import { DisputeType } from '@prisma/client'

export class CancelOrderDto {
  @IsString()
  @MaxLength(500)
  reason: string
}

export class DisputeOrderDto {
  @IsEnum(DisputeType)
  disputeType: DisputeType

  @IsString()
  @MaxLength(2000)
  description: string
}

export class ReviewOrderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string
}
