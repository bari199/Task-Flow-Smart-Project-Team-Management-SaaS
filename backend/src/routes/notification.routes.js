import { Router } from "express";

import {
  listNotificationsController,
  unreadCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
} from "../controller/notification.contoller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/unread-count", unreadCountController);

router.patch("/read-all", markAllNotificationsReadController);

router.get("/", listNotificationsController);

router.patch("/:notificationId/read", markNotificationReadController);

router.delete("/:notificationId", deleteNotificationController);

export default router;
