import api from "./api";
import { NotificationItem } from "./types";
export type { NotificationItem } from "./types";
export const notificationService = {
  async list(unreadOnly = false) {
    return (
      await api.get<NotificationItem[]>("/notifications", {
        params: unreadOnly ? { unreadOnly: true } : undefined,
      })
    ).data;
  },
  async getUnreadCount() {
    return (await api.get<number>("/notifications/unread/count")).data;
  },
  async markAllAsRead() {
    await api.patch("/notifications/read-all");
  },
  async markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
  },
};
