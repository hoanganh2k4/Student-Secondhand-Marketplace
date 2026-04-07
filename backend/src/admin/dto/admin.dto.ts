import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { DisputeResolution } from '@prisma/client'

export class ResolveDisputeDto {
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string
}

export class SuspendUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
