import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeStatus } from '../medication-schedule.entity';

export class UpdateIntakeDto {
  @ApiProperty({
    enum: IntakeStatus,
    example: IntakeStatus.TAKEN,
    description: 'The new status of the medication intake',
  })
  @IsEnum(IntakeStatus)
  status: IntakeStatus;

  @ApiPropertyOptional({
    example: 'Took with breakfast',
    description: 'Optional notes about the intake',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
