import { z } from "zod";

import {
  listNotificationsService,
  countUnreadNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
  deleteNotificationService,
} from "../services/notification.service.js";

const notificationParamsSchema = z.object({
  notificationId: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.enum(["true", "false"]).default("false"),
});

function getUserId(req) {
  return req.session?.userId ?? req.user?.id;
}

function requireUserId(req) {
  const userId = getUserId(req);

  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return userId;
}

export async function listNotificationsController(req, res, next) {
  try {
    const userId = requireUserId(req);
    const query = listQuerySchema.parse(req.query);

    const result = await listNotificationsService({
      userId,
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly === "true",
    });

    return res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function unreadCountController(req, res, next) {
  try {
    const userId = requireUserId(req);

    const count = await countUnreadNotificationsService(userId);

    return res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadController(req, res, next) {
  try {
    const userId = requireUserId(req);
    const { notificationId } = notificationParamsSchema.parse(req.params);

    const notification = await markNotificationReadService({
      notificationId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsReadController(req, res, next) {
  try {
    const userId = requireUserId(req);

    const result = await markAllNotificationsReadService(userId);

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotificationController(req, res, next) {
  try {
    const userId = requireUserId(req);
    const { notificationId } = notificationParamsSchema.parse(req.params);

    const notification = await deleteNotificationService({
      notificationId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}
