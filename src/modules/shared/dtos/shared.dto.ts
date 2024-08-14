import { IsOptional, IsString } from 'class-validator';

export class AuthDto {
  @IsOptional()
  @IsString()
  referral_code: string;
}
