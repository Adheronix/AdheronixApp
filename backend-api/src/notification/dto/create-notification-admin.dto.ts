import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../notification.entity';

export class CreateNotificationAdminDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Type of notification',
    default: NotificationType.GENERAL,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Schedule notification for future date' })
  @IsOptional()
  @IsDateString()
  scheduled_for?: string;
}
