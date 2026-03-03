import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMedicationDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'patient_med_list_v1',
      prescription: [{ name: 'Amoxicillin', dose: '500mg', freq: '3/day' }],
    },
  })
  @IsObject()
  prescription: Record<string, unknown>;

  @ApiProperty({ example: 'Take after meals' })
  @IsString()
  @IsNotEmpty()
  intake_recommendation: string;

  @ApiProperty({ example: '7 days' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ enum: ['clinician', 'pharmacist'] })
  @IsString()
  @IsIn(['clinician', 'pharmacist'])
  source: string;

  @ApiProperty({ example: 2, description: 'Number of times per day' })
  @IsNotEmpty()
  frequency: number;
}
