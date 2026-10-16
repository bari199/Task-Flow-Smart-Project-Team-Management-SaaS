import {
  getPreferencesByUserId,
  updatePreferencesByUserId,
} from "../repositories/notification.preference.repository.js";

const ALLOWED_FIELDS = [
  "in_app_enabled",
  "email_enabled",
  "task_reminders_enabled",
  "security_alerts_enabled",
];

export const getNotificationPreferences = async (userId) => {
  if (!userId) {
    const error = new Error("Authenticated user ID is required");
    error.statusCode = 401;
    throw error;
  }

  return getPreferencesByUserId(userId);
};

export const updateNotificationPreferences = async (userId, payload) => {
  if (!userId) {
    const error = new Error("Authenticated user ID is required");
    error.statusCode = 401;
    throw error;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object");
    error.statusCode = 400;
    throw error;
  }

  const keys = Object.keys(payload);

  if (keys.length === 0) {
    const error = new Error("Provide at least one preference to update");
    error.statusCode = 400;
    throw error;
  }

  const unknownFields = keys.filter((key) => !ALLOWED_FIELDS.includes(key));

  if (unknownFields.length > 0) {
    const error = new Error(
      `Unsupported preference fields: ${unknownFields.join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  for (const key of keys) {
    if (typeof payload[key] !== "boolean") {
      const error = new Error(`${key} must be a boolean`);
      error.statusCode = 400;
      throw error;
    }
  }

  return updatePreferencesByUserId(userId, payload);
};
