import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../notification.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingNotifications() {
    this.logger.log('Checking for pending notifications...');

    try {
      const pendingNotifications =
        await this.notificationService.getPendingNotifications();

      if (pendingNotifications.length === 0) {
        this.logger.debug('No pending notifications found');
        return;
      }

      this.logger.log(
        `Found ${pendingNotifications.length} pending notifications`,
      );

      for (const notification of pendingNotifications) {
        await this.notificationService.sendNotification(notification);
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending notifications: ${error.message}`,
      );
    }
  }
}
