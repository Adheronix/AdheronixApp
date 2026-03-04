import * as Notifications from 'expo-notifications';
import api from './api';

/**
 * Registers the device for push notifications and sends the Expo push token
 * to the backend (`PATCH /patient/profile/push-token`).
 *
 * Call this after login/signup and optionally on app start.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Only run on native devices
  // On web this will no-op and return null.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDevice = (Notifications as any).isDevice ?? true;

  if (!isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const pushToken = await Notifications.getExpoPushTokenAsync();
  const token =
    typeof pushToken === 'string' ? pushToken : (pushToken as any).data ?? null;

  if (!token) {
    return null;
  }

  try {
    await api.patch('/patient/profile/push-token', { token });
  } catch {
    // Ignore backend errors here; app can continue without push
  }

  return token;
}

