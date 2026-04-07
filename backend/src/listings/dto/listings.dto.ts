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
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string

  @IsUUID()
  categoryId: string

  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string

  @IsEnum(ItemCondition)
  condition: ItemCondition

  @IsString()
  @IsOptional()
  @MaxLength(500)
  conditionNotes?: string

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantityAvailable: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceExpectation: number

  @IsBoolean()
  @IsOptional()
  priceFlexible?: boolean

  @IsString()
  @IsOptional()
  location?: string

  @IsString()
  @IsOptional()
  availabilityWindow?: string
}

export class UpdateListingDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string

  @IsUUID()
  @IsOptional()
  categoryId?: string

  @IsUUID()
  @IsOptional()
  subcategoryId?: string

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition

  @IsString()
  @IsOptional()
  @MaxLength(500)
  conditionNotes?: string

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantityAvailable?: number

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceExpectation?: number

  @IsBoolean()
  @IsOptional()
  priceFlexible?: boolean

  @IsString()
  @IsOptional()
  location?: string

  @IsString()
  @IsOptional()
  availabilityWindow?: string
}
