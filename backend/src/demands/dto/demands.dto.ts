import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ItemCondition, Urgency } from '@prisma/client'

export class CreateDemandDto {
  @ApiProperty({ example: 'Cần mua laptop sinh viên', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Category UUID — get from GET /api/categories' })
  @IsUUID()
  categoryId: string

  @ApiPropertyOptional({ example: null, description: 'Subcategory UUID (optional)' })
  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @ApiPropertyOptional({ example: 'Dùng để lập trình và học tập. Cần pin tốt, RAM ≥ 8GB, chạy được VSCode mượt.', maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string

  @ApiProperty({ example: 5000000, description: 'Minimum budget in VND' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  budgetMin: number

  @ApiProperty({ example: 10000000, description: 'Maximum budget in VND' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  budgetMax: number

  @ApiPropertyOptional({ enum: ItemCondition, example: 'good', description: 'Minimum acceptable condition: poor | fair | good | very_good | like_new' })
  @IsEnum(ItemCondition)
  @IsOptional()
  preferredCondition?: ItemCondition

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityNeeded?: number

  @ApiPropertyOptional({ example: 'Quận 10, TP.HCM' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ enum: Urgency, example: 'within_week', description: 'flexible | within_week | within_month' })
  @IsEnum(Urgency)
  @IsOptional()
  urgency?: Urgency

  @ApiPropertyOptional({ example: 'Ưu tiên MacBook hoặc ThinkPad. Không cần màn hình rời.', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialRequirements?: string
}

export class UpdateDemandDto {
  @ApiPropertyOptional({ example: 'Cần mua laptop sinh viên giá rẻ' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(120)
  title?: string

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsOptional()
  categoryId?: string

  @ApiPropertyOptional({ example: null })
  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @ApiPropertyOptional({ example: 'Dùng để lập trình, cần pin trên 6 tiếng.' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ example: 4000000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetMin?: number

  @ApiPropertyOptional({ example: 12000000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetMax?: number

  @ApiPropertyOptional({ enum: ItemCondition, example: 'fair' })
  @IsEnum(ItemCondition)
  @IsOptional()
  preferredCondition?: ItemCondition

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityNeeded?: number

  @ApiPropertyOptional({ example: 'Quận 1, TP.HCM' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ enum: Urgency, example: 'flexible' })
  @IsEnum(Urgency)
  @IsOptional()
  urgency?: Urgency

  @ApiPropertyOptional({ example: 'Không cần màn hình rời.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialRequirements?: string
}
