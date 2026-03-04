import api from './api';

export interface NotificationItem {
  notification_id: string;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  read_at?: string | null;
}

export const notificationService = {
  async list(unreadOnly = false): Promise<NotificationItem[]> {
    const response = await api.get<NotificationItem[]>('/notifications', {
      params: unreadOnly ? { unreadOnly: true } : undefined,
    });
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<number>('/notifications/unread/count');
    return response.data;
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};

