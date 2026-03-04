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

/**
 * Production-ready push implementation using Expo Push API.
 *
 * The `token` field should be an **Expo push token** (e.g. `ExponentPushToken[...]`)
 * which the mobile app obtains via `expo-notifications` and sends to the backend.
 */
@Injectable()
export class PushNotificationService implements IPushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  async send(payload: PushNotificationPayload): Promise<void> {
    try {
      if (!payload.token) {
        this.logger.warn('No push token provided, skipping push');
        return;
      }

      const body = {
        to: payload.token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      };

      // Node 18+ has global fetch available
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(
          `Expo push request failed with status ${response.status}: ${text}`,
        );
        return;
      }

      const json = (await response.json()) as any;
      this.logger.log(
        `Expo push response: ${JSON.stringify(json, null, 2)}`,
      );
    } catch (error: any) {
      this.logger.error(`Error sending push notification: ${error.message}`);
    }
  }
}
