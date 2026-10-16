import { Worker } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { createNotification } from "../repositories/notification.repository.js";

export function startNotificationWorker() {
  const worker = new Worker(
    "task-flow-notifications",
    async (job) => {
      switch (job.name) {
        case "process-notification": {
          const {
            eventId,
            type,
            recipientUserId,
            actorUserId,
            teamId,
            projectId,
            taskId,
          } = job.data ?? {};

          // Validate notification payload
          if (
            !eventId ||
            !recipientUserId ||
            !type ||
            !taskId ||
            !projectId ||
            !teamId
          ) {
            throw new Error("Invalid notification job payload");
          }

          // Handle supported notification types
          if (type !== "task_assigned") {
            throw new Error(`Unsupported notification type: ${type}`);
          }

          // Do not notify users about their own action
          if (actorUserId && String(actorUserId) === String(recipientUserId)) {
            return {
              processed: true,
              skipped: true,
              reason: "self-notification",
            };
          }

          // Save the notification in PostgreSQL
          const notification = await createNotification({
            eventId,
            recipientUserId,
            actorUserId,
            type,
            title: "You were assigned to a task",
            message: "A task in your project has been assigned to you.",
            taskId,
            data: {
              teamId,
              projectId,
              taskId,
              actorUserId: actorUserId ?? null,
            },
          });

          return {
            processed: true,
            duplicate: notification === null,
            notificationId: notification?.id ?? null,
          };
        }

        case "send-email": {
          // Email sending is not implemented yet.
          // Keep this job explicit instead of reporting false success.
          throw new Error("Email handler is not configured yet");
        }

        default: {
          throw new Error(`Unknown job type: ${job.name}`);
        }
      }
    },
    {
      connection: bullMQConnection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job, result) => {
    console.log(`Notification job completed: ${job.id}`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`Notification job failed: ${job?.id}`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Notification worker error:", error.message);
  });

  return worker;
}
