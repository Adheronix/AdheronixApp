import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  full_names?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  allergies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergency_contact_phone?: string;

  @IsOptional()
  @IsBoolean()
  push_notifications_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  email_notifications_enabled?: boolean;
}

export class UpdatePushTokenDto {
  @IsString()
  @MaxLength(512)
  token: string;
}
