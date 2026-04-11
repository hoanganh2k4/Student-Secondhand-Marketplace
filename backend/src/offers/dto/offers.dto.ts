import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsDateString, Min, MaxLength } from 'class-validator'
import { FulfillmentMethod } from '@prisma/client'

export class CreateOfferDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Conversation UUID — get from GET /api/conversations' })
  @IsString()
  conversationId: string

  @ApiProperty({ example: 1, description: 'Number of units' })
  @IsInt()
  @Min(1)
  quantity: number

  @ApiProperty({ example: 17500000, description: 'Proposed price per unit in VND' })
  @IsNumber()
  @Min(0)
  proposedPrice: number

  @ApiProperty({ enum: FulfillmentMethod, example: 'pickup', description: 'pickup | delivery | flexible' })
  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod

  @ApiPropertyOptional({ example: 'Sân BK cơ sở 2, 268 Lý Thường Kiệt' })
  @IsOptional()
  @IsString()
  meetupLocation?: string

  @ApiPropertyOptional({ example: '2026-04-20T15:00:00.000Z', description: 'ISO 8601 datetime for meetup' })
  @IsOptional()
  @IsDateString()
  meetupTime?: string

  @ApiPropertyOptional({ example: 'Bao gồm sạc, hộp máy. Kiểm tra máy trực tiếp trước khi thanh toán.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsNotes?: string
}

export class CounterOfferDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number

  @ApiProperty({ example: 16800000, description: 'Counter-proposed price in VND' })
  @IsNumber()
  @Min(0)
  proposedPrice: number

  @ApiProperty({ enum: FulfillmentMethod, example: 'pickup' })
  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod

  @ApiPropertyOptional({ example: 'Nhà văn hóa sinh viên ĐH Quốc gia' })
  @IsOptional()
  @IsString()
  meetupLocation?: string

  @ApiPropertyOptional({ example: '2026-04-21T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  meetupTime?: string

  @ApiPropertyOptional({ example: 'Giá thương lượng thêm, vui lòng liên hệ lại.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsNotes?: string
}
