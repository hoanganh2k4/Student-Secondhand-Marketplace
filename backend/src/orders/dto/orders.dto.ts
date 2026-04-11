import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator'
import { DisputeType } from '@prisma/client'

export class CancelOrderDto {
  @ApiProperty({ example: 'Người mua không đến điểm hẹn sau 2 lần reschedule.', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason: string
}

export class DisputeOrderDto {
  @ApiProperty({ enum: DisputeType, example: 'item_not_as_described', description: 'item_not_as_described | no_show | fake_proof | other' })
  @IsEnum(DisputeType)
  disputeType: DisputeType

  @ApiProperty({ example: 'Máy không đúng như mô tả: pin chỉ còn 60% thay vì 98% như đã nói. Ảnh bằng chứng đính kèm.', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  description: string
}

export class ReviewOrderDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Rating from 1 (poor) to 5 (excellent)' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number

  @ApiPropertyOptional({ example: 'Người bán uy tín, máy đúng như mô tả. Giao dịch nhanh gọn, rất hài lòng.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string
}
