import { apiClient } from '../client';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export const notificationService = {
  getMyNotifications: async (): Promise<NotificationResponse> => {
    const res = await apiClient.get<any>('/notifications');
    return res?.data || res;
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.patch<any>(`/notifications/${id}/read`);
    return res?.data || res;
  },

  markAllAsRead: async (): Promise<{ success: boolean; message: string }> => {
    return apiClient.patch<any>('/notifications/read-all');
  },
};
