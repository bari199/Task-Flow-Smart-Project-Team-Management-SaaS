import { Queue } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";

export const notificationQueue = new Queue("task-flow-notifications", {
  connection: bullMQConnection,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 2000,
    },

    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000,
    },

    removeOnFail: false,
  },
});

export async function enqueueNotificationJob(data) {
  return notificationQueue.add("process-notification", data, {
    // Use a stable, unique event ID when retrying the
    // same logical event to reduce duplicate enqueues.
    ...(data.eventId ? { jobId: data.eventId } : {}),
  });
}

export async function enqueueEmailJob(data) {
  return notificationQueue.add("send-email", data);
}
