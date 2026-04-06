import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator'

export class SendMagicLinkDto {
  @IsEmail()
  email: string
}

export class VerifyMagicLinkDto {
  @IsString()
  token: string
}

export class RegisterDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsString()
  name: string

  @IsString()
  university: string

  @IsOptional()
  graduationYear?: number
}

export class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  password: string
}

export class OnboardingDto {
  @IsString()
  name: string

  @IsString()
  university: string

  @IsOptional()
  graduationYear?: number
}
