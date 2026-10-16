import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification.preference.service.js";

const getUserId = (req) => req.session?.userId ?? req.user?.id;

export const getPreferences = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const preferences = await getNotificationPreferences(userId);

    return res.status(200).json({
      success: true,
      message: "Notification preferences fetched successfully",
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const preferences = await updateNotificationPreferences(userId, req.body);

    return res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
};
