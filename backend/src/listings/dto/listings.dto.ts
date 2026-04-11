import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ItemCondition } from '@prisma/client'

export class CreateListingDto {
  @ApiProperty({ example: 'MacBook Pro 2020 M1 13 inch', minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Category UUID — get from GET /api/categories' })
  @IsUUID()
  categoryId: string

  @ApiPropertyOptional({ example: null, description: 'Subcategory UUID (optional)' })
  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @ApiPropertyOptional({ example: 'MacBook Pro M1 2020, 8GB RAM, 256GB SSD. Máy nguyên seal, pin còn 98%. Không có vết trầy xước.', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string

  @ApiProperty({ enum: ItemCondition, example: 'like_new', description: 'poor | fair | good | very_good | like_new' })
  @IsEnum(ItemCondition)
  condition: ItemCondition

  @ApiPropertyOptional({ example: 'Pin 98%, không trầy xước, đủ phụ kiện theo máy.', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  conditionNotes?: string

  @ApiProperty({ example: 1, description: 'Number of units available' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantityAvailable: number

  @ApiProperty({ example: 18500000, description: 'Asking price in VND' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceExpectation: number

  @ApiPropertyOptional({ example: true, description: 'Whether price is negotiable' })
  @IsBoolean()
  @IsOptional()
  priceFlexible?: boolean

  @ApiPropertyOptional({ example: 'Quận Bình Thạnh, TP.HCM' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ example: 'Thứ 2–6 sau 18h, cuối tuần cả ngày' })
  @IsString()
  @IsOptional()
  availabilityWindow?: string
}

export class UpdateListingDto {
  @ApiPropertyOptional({ example: 'MacBook Pro 2020 M1 — giảm giá' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsOptional()
  categoryId?: string

  @ApiPropertyOptional({ example: null })
  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @ApiPropertyOptional({ example: 'Bán gấp, giảm giá. Máy đẹp, dùng nhẹ.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string

  @ApiPropertyOptional({ enum: ItemCondition, example: 'very_good' })
  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition

  @ApiPropertyOptional({ example: 'Có 1 vết trầy nhỏ ở góc máy, không ảnh hưởng sử dụng.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  conditionNotes?: string

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityAvailable?: number

  @ApiPropertyOptional({ example: 17000000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceExpectation?: number

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  priceFlexible?: boolean

  @ApiPropertyOptional({ example: 'Quận 1, TP.HCM' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ example: 'Cuối tuần' })
  @IsString()
  @IsOptional()
  availabilityWindow?: string
}
