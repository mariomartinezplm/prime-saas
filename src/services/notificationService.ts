import api from '../lib/api';
import type { Notification, APIResponse } from '../types';

export const notificationService = {
  getAll: async (): Promise<Notification[]> => {
    const response = await api.get<APIResponse<{ notifications: Notification[] }>>('/notifications');
    return response.data.data.notifications;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get<APIResponse<{ count: number }>>('/notifications/unread-count');
    return response.data.data.count;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await api.put<APIResponse<{ notification: Notification }>>(`/notifications/${id}/read`);
    return response.data.data.notification;
  },

  markAllAsRead: async (): Promise<number> => {
    const response = await api.put<APIResponse<{ updatedCount: number }>>('/notifications/read-all');
    return response.data.data.updatedCount;
  },
};
