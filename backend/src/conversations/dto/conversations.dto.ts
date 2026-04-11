import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsEnum, IsOptional, IsNumber, IsPositive, MinLength, MaxLength, IsDateString, IsEmail } from 'class-validator'
import { EvidenceRequestType, MessageType } from '@prisma/client'

export class SendMessageDto {
  @ApiProperty({ enum: MessageType, example: 'text', description: 'text | image | video | system | evidence_request | offer_notification' })
  @IsEnum(MessageType)
  messageType: MessageType

  @ApiProperty({ example: 'Cho mình hỏi thêm về tình trạng pin nhé, còn bao nhiêu % vậy bạn?', maxLength: 2000 })
  @IsString()
  @MinLength(0)
  @MaxLength(2000)
  body: string

  @ApiPropertyOptional({ example: 'listings/uuid/img_20260411_abc123.jpg', description: 'MinIO object key from POST /api/uploads — required when messageType is image or video' })
  @IsOptional()
  @IsString()
  mediaKey?: string
}

export class CreateEvidenceRequestDto {
  @ApiProperty({ enum: EvidenceRequestType, example: 'additional_photo', description: 'additional_photo | video | measurement | document | live_demo' })
  @IsEnum(EvidenceRequestType)
  requestType: EvidenceRequestType

  @ApiProperty({ example: 'Vui lòng chụp thêm ảnh góc cạnh máy và ảnh màn hình battery health.', minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description: string

  @ApiProperty({ example: '2026-04-18T23:59:00.000Z', description: 'ISO 8601 deadline for fulfilling the request' })
  @IsDateString()
  dueAt: string
}

// ─── ORDER REQUESTS ───────────────────────────────────────────────────────────

export class CreateOrderRequestDto {
  @ApiPropertyOptional({ example: 1, description: 'Quantity to order (defaults to 1)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number
}

export class SellerInfoDto {
  @ApiProperty({ example: 17500000, description: 'Final agreed price in VND' })
  @IsNumber()
  @IsPositive()
  price: number

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number
}

export class BuyerInfoDto {
  @ApiProperty({ example: '0901234567', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  phone: string

  @ApiProperty({ example: 'hoanganh@student.hcmut.edu.vn' })
  @IsEmail()
  email: string

  @ApiProperty({ example: '268 Lý Thường Kiệt, P.14, Q.10, TP.HCM', minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  deliveryAddress: string

  @ApiProperty({ enum: ['pickup', 'delivery', 'flexible'], example: 'pickup', description: 'pickup | delivery | flexible' })
  @IsEnum(['pickup', 'delivery', 'flexible'])
  fulfillmentMethod: 'pickup' | 'delivery' | 'flexible'
}

export class FulfillEvidenceRequestDto {
  @ApiProperty({ enum: ['fulfilled', 'rejected'], example: 'fulfilled', description: 'fulfilled | rejected' })
  @IsEnum(['fulfilled', 'rejected'])
  action: 'fulfilled' | 'rejected'

  @ApiPropertyOptional({ example: 'Ảnh không đủ rõ để xác nhận tình trạng.', maxLength: 500, description: 'Required when action is rejected' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string
}
