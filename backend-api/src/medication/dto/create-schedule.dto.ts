import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({
    example: 'uuid-medication-id',
    description: 'The medication ID to schedule',
  })
  @IsUUID()
  @IsNotEmpty()
  medication_id: string;

  @ApiProperty({
    example: ['08:00', '14:00', '20:00'],
    description: 'Array of times in HH:mm format for medication intake',
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    each: true,
    message: 'Each time must be in HH:mm format (e.g., 08:00, 14:30)',
  })
  times: string[];
}
