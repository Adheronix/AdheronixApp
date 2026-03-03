import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleNotificationDto {
  @ApiProperty({
    example: 'uuid-of-medication',
    description: 'The ID of the medication to schedule',
  })
  @IsUUID()
  @IsNotEmpty()
  medication_id: string;

  @ApiProperty({
    example: ['08:00', '20:00'],
    description:
      'Array of time strings in HH:mm format. Length must match medication frequency.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  times: string[];
}
