import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { DisputeResolution } from '@prisma/client'

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeResolution, example: 'resolved_for_buyer', description: 'resolved_for_buyer | resolved_for_seller | mutual | dismissed' })
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution

  @ApiPropertyOptional({ example: 'Người mua đã cung cấp đủ bằng chứng. Hoàn tiền cho người mua.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string
}

export class SuspendUserDto {
  @ApiPropertyOptional({ example: 'Vi phạm quy định: đăng sản phẩm giả mạo.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
