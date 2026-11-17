import { Injectable } from '@nestjs/common';

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
  async send(payload: PushNotificationPayload): Promise<void> {
    if (!/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(payload.token))
      throw new Error('Invalid Expo push token');
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Push provider rejected the request');
    const result = (await response.json()) as { data?: { status?: string } };
    if (result.data?.status !== 'ok')
      throw new Error('Push provider did not accept the notification');
  }
}
