import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { Patient } from '../patient/patient.entity';
import { NotificationSchedulerService } from './scheduler/notification-scheduler.service';
import { PushNotificationService } from './channels/push-notification.service';
import { EmailNotificationService } from './channels/email-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Patient])],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationSchedulerService,
    PushNotificationService,
    EmailNotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
