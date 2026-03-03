import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus } from '../notification.entity';

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    enum: NotificationStatus,
    description: 'Update notification status',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;
}
