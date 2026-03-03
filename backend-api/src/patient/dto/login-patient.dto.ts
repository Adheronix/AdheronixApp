import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginPatientDto {
  @ApiProperty({ example: 'patient@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'patient_user', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsNotEmpty()
  password: string;
}
