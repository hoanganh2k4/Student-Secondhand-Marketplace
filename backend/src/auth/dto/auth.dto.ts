import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator'

export class SendMagicLinkDto {
  @ApiProperty({ example: 'hoanganh@student.hcmut.edu.vn' })
  @IsEmail()
  email: string
}

export class VerifyMagicLinkDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...', description: 'Token from magic link email' })
  @IsString()
  token: string
}

export class RegisterDto {
  @ApiProperty({ example: 'hoanganh@student.hcmut.edu.vn' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string

  @ApiProperty({ example: 'Nguyễn Huy Hoàng Anh' })
  @IsString()
  name: string

  @ApiProperty({ example: 'HCMUT' })
  @IsString()
  university: string

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  graduationYear?: number
}

export class LoginDto {
  @ApiProperty({ example: 'hoanganh@student.hcmut.edu.vn' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string
}

export class OnboardingDto {
  @ApiProperty({ example: 'Nguyễn Huy Hoàng Anh' })
  @IsString()
  name: string

  @ApiProperty({ example: 'HCMUT' })
  @IsString()
  university: string

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  graduationYear?: number
}
