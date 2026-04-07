import { IsString, IsEnum, IsOptional, IsNumber, IsPositive, MinLength, MaxLength, IsDateString, IsEmail } from 'class-validator'
import { EvidenceRequestType, MessageType } from '@prisma/client'

export class SendMessageDto {
  @IsEnum(MessageType)
  messageType: MessageType

  @IsString()
  @MinLength(0)
  @MaxLength(2000)
  body: string

  /** MinIO object key returned by POST /api/uploads — required when messageType is image or video */
  @IsOptional()
  @IsString()
  mediaKey?: string
}

export class CreateEvidenceRequestDto {
  @IsEnum(EvidenceRequestType)
  requestType: EvidenceRequestType

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description: string

  @IsDateString()
  dueAt: string
}

// ─── ORDER REQUESTS ───────────────────────────────────────────────────────────

export class CreateOrderRequestDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number
}

export class SellerInfoDto {
  @IsNumber()
  @IsPositive()
  price: number

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number
}

export class BuyerInfoDto {
  @IsString()
  @MaxLength(20)
  phone: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  deliveryAddress: string

  @IsEnum(['pickup', 'delivery', 'flexible'])
  fulfillmentMethod: 'pickup' | 'delivery' | 'flexible'
}

export class FulfillEvidenceRequestDto {
  @IsEnum(['fulfilled', 'rejected'])
  action: 'fulfilled' | 'rejected'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string
}
