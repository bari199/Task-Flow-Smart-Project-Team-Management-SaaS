import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../repositories/notification.repository.js";

export const listNotificationsService = (data) => listNotifications(data);

export const countUnreadNotificationsService = (userId) =>
  countUnreadNotifications(userId);

export const markNotificationReadService = (data) => markNotificationRead(data);

export const markAllNotificationsReadService = (userId) =>
  markAllNotificationsRead(userId);

export const deleteNotificationService = (data) => deleteNotification(data);
