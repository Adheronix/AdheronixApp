import { Injectable, Logger } from '@nestjs/common';

export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface IPushNotificationService {
  send(payload: PushNotificationPayload): Promise<void>;
}

@Injectable()
export class PushNotificationService implements IPushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  async send(payload: PushNotificationPayload): Promise<void> {
    // In a real implementation, this would use firebase-admin or similar
    this.logger.log(`[MOCK PUSH] Sending to ${payload.token}`);
    this.logger.log(`Title: ${payload.title}`);
    this.logger.log(`Body: ${payload.body}`);
    if (payload.data) {
      this.logger.log(`Data: ${JSON.stringify(payload.data)}`);
    }
  }
}
