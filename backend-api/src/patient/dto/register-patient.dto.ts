import { IsEmail, IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterPatientDto {
  @ApiProperty({ example: 'patient@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'janedoe' })
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  full_names: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiProperty({ minLength: 6, example: 'StrongPass123' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
