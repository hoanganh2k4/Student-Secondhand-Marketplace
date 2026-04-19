import { IsEnum, IsString } from 'class-validator'

export enum PaymentGatewayDto {
  MOMO  = 'momo',
  VNPAY = 'vnpay',
}

export class InitiatePaymentDto {
  @IsString()
  orderRequestId: string

  @IsEnum(PaymentGatewayDto)
  gateway: PaymentGatewayDto
}
