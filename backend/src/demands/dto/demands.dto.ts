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
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string

  @IsUUID()
  categoryId: string

  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  budgetMin: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  budgetMax: number

  @IsEnum(ItemCondition)
  @IsOptional()
  preferredCondition?: ItemCondition

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityNeeded?: number

  @IsString()
  @IsOptional()
  location?: string

  @IsEnum(Urgency)
  @IsOptional()
  urgency?: Urgency

  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialRequirements?: string
}

export class UpdateDemandDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(120)
  title?: string

  @IsUUID()
  @IsOptional()
  categoryId?: string

  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetMin?: number

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetMax?: number

  @IsEnum(ItemCondition)
  @IsOptional()
  preferredCondition?: ItemCondition

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityNeeded?: number

  @IsString()
  @IsOptional()
  location?: string

  @IsEnum(Urgency)
  @IsOptional()
  urgency?: Urgency

  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialRequirements?: string
}
