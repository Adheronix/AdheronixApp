import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeStatus } from '../medication-schedule.entity';

export class IntakeNoteDto {
  @ApiPropertyOptional({
    example: 'Took with breakfast',
    description: 'Optional notes about the intake',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateIntakeDto extends IntakeNoteDto {
  @ApiProperty({
    enum: IntakeStatus,
    example: IntakeStatus.TAKEN,
    description: 'The patient-reported status of the medication intake',
  })
  @IsEnum(IntakeStatus)
  status: IntakeStatus;
}
