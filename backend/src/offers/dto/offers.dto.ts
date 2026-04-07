import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsDateString, Min, Max, MaxLength } from 'class-validator'
import { FulfillmentMethod } from '@prisma/client'

export class CreateOfferDto {
  @IsString()
  conversationId: string

  @IsInt()
  @Min(1)
  quantity: number

  @IsNumber()
  @Min(0)
  proposedPrice: number

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod

  @IsOptional()
  @IsString()
  meetupLocation?: string

  @IsOptional()
  @IsDateString()
  meetupTime?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsNotes?: string
}

export class CounterOfferDto {
  @IsInt()
  @Min(1)
  quantity: number

  @IsNumber()
  @Min(0)
  proposedPrice: number

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod

  @IsOptional()
  @IsString()
  meetupLocation?: string

  @IsOptional()
  @IsDateString()
  meetupTime?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsNotes?: string
}
