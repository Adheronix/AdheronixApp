import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RegisterPatientDto } from '../../patient/dto/register-patient.dto';

export class RegisterAdminDto extends RegisterPatientDto {
  @ApiProperty({
    description: 'Shared secret to create an admin account',
    example: 'super-secret',
  })
  @IsNotEmpty()
  adminKey: string;
}
