import "dotenv/config";

import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { createServer } from "node:http";

import { sessionMiddleware } from "./src/config/session.js";

import {
  generalApiLimiter,
  initializeRateLimiters,
} from "./src/middlewares/rate.limit.middleware.js";

import { validateEnv } from "./src/config/env.js";

import { pool, connectDatabase } from "./src/config/database.js";

import {
  redisClient,
  connectRedis,
  isRedisReady,
  disconnectRedis,
} from "./src/config/redis.js";

import { startNotificationWorker } from "./src/workers/notification.worker.js";

import { notificationQueue } from "./src/queues/notification.queue.js";

// Routes
import authRoutes from "./src/routes/auth.routes.js";
import passwordRoutes from "./src/routes/password.routes.js";
import teamRoutes from "./src/routes/team.routes.js";
import oauthRoutes from "./src/routes/oauth.routes.js";
import taskCommentRoutes from "./src/routes/task.comment.routes.js";
import projectRoutes from "./src/routes/project.routes.js";
import taskRoutes from "./src/routes/task.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import notificationPreferenceRoutes from "./src/routes/notification.preference.routes.js";
// Passport configuration
import { configurePassport } from "./src/config/passport.js";

// Error handling
import {
  notFoundHandler,
  errorHandler,
} from "./src/middlewares/error.middleware.js";

// ========================================
// APPLICATION CONFIGURATION
// ========================================

const config = validateEnv();

const app = express();
const server = createServer(app);

const PgSessionStore = connectPgSimple(session);

let notificationWorker = null;
let isShuttingDown = false;

export { app, server, startServer };

// ========================================
// TRUST PROXY
// ========================================

if (config.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

// ========================================
// SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ========================================
// REQUEST BODY PARSING
// ========================================

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: true }));

// ========================================
// SESSION CONFIGURATION
// ========================================

app.use(
  session({
    name: config.sessionCookieName,

    store: new PgSessionStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),

    secret: config.sessionSecret,

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  }),
);

// ========================================
// PASSPORT CONFIGURATION
// ========================================

configurePassport();

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// ========================================
// ROOT ENDPOINT
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Task-Flow API is running",
  });
});

// ========================================
// REDIS HEALTH CHECK
// ========================================

app.get("/health/redis", async (req, res) => {
  try {
    if (!isRedisReady()) {
      return res.status(503).json({
        success: false,
        message: "Redis is not connected",
        status: "disconnected",
      });
    }

    await redisClient.ping();

    return res.status(200).json({
      success: true,
      message: "Redis is healthy",
      status: "connected",
    });
  } catch (error) {
    console.error("Redis health check failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "Redis health check failed",
      status: "disconnected",
    });
  }
});

// ========================================
// APPLICATION HEALTH CHECK
// ========================================

app.get("/api/v1/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    if (!isRedisReady()) {
      return res.status(503).json({
        success: false,
        message: "Redis is unavailable",
        services: {
          api: "ok",
          database: "ok",
          redis: "unavailable",
        },
      });
    }

    await redisClient.ping();

    return res.status(200).json({
      success: true,
      message: "All services are healthy",
      services: {
        api: "ok",
        database: "ok",
        redis: "ok",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "A required service is unavailable",
    });
  }
});

// ========================================
// RATE LIMITING
// ========================================

// The limiter is initialized after Redis connects,
// before the server begins accepting requests.
app.use("/api/v1", generalApiLimiter);

// ========================================
// API ROUTES
// ========================================

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/password", passwordRoutes);
app.use("/api/v1/auth", oauthRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1", projectRoutes);
app.use("/api/v1", taskRoutes);
app.use("/api/v1", taskCommentRoutes);

app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/notification-preferences", notificationPreferenceRoutes);
// ========================================
// ERROR HANDLING
// Keep these last
// ========================================

app.use(notFoundHandler);
app.use(errorHandler);
app.use(helmet());
// ========================================
// RESOURCE CLEANUP
// ========================================

async function closeResource(name, closeFn) {
  try {
    await closeFn();
    console.log(`${name} closed successfully`);
  } catch (error) {
    console.error(`Failed to close ${name}:`, error.message);
    throw error;
  }
}

async function closeHttpServer() {
  if (!server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  const shutdownTasks = [
    ["HTTP server", closeHttpServer],

    [
      "Notification worker",
      async () => {
        if (notificationWorker) {
          await notificationWorker.close();
          notificationWorker = null;
        }
      },
    ],

    ["Notification queue", () => notificationQueue.close()],
    ["PostgreSQL pool", () => pool.end()],
    ["Redis connection", () => disconnectRedis()],
  ];

  let hasErrors = false;

  for (const [name, closeFn] of shutdownTasks) {
    try {
      await closeResource(name, closeFn);
    } catch {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  }

  console.log("Task-Flow shutdown completed");
}

// ========================================
// START SERVER
// ========================================

async function startServer() {
  let startupStep = "initialization";

  try {
    // Validate environment
    startupStep = "environment validation";
    validateEnv();

    // Connect PostgreSQL
    startupStep = "PostgreSQL connection";

    console.log("Connecting to PostgreSQL...");

    await connectDatabase();

    console.log("PostgreSQL connected successfully.");

    // Connect Redis
    startupStep = "Redis connection";

    console.log("Connecting to Redis...");

    const redisConnected = await connectRedis();

    if (!redisConnected || !isRedisReady()) {
      throw new Error("Could not connect to Redis");
    }

    console.log("Redis connected successfully.");

    // Initialize all rate limiters after Redis connects
    startupStep = "rate limiter initialization";

    initializeRateLimiters();

    console.log("Rate limiters initialized.");

    // Start notification worker after Redis connects
    startupStep = "notification worker startup";

    notificationWorker = startNotificationWorker();

    console.log("Notification worker started.");

    // Start HTTP server
    startupStep = "HTTP server startup";

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };

      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);

      server.listen(config.port);
    });

    console.log(`Task-Flow API running at http://localhost:${config.port}`);

    console.log(`Environment: ${config.nodeEnv}`);
  } catch (error) {
    console.error(`Failed during: ${startupStep}`);
    console.error("Error:", error);

    process.exitCode = 1;

    const cleanupTasks = [
      ["HTTP server", closeHttpServer],

      [
        "Notification worker",
        async () => {
          if (notificationWorker) {
            await notificationWorker.close();
            notificationWorker = null;
          }
        },
      ],

      ["Notification queue", () => notificationQueue.close()],
      ["PostgreSQL pool", () => pool.end()],
      ["Redis connection", () => disconnectRedis()],
    ];

    for (const [name, cleanup] of cleanupTasks) {
      try {
        await closeResource(name, cleanup);
      } catch (cleanupError) {
        console.error(
          `Startup cleanup failed for ${name}:`,
          cleanupError.message,
        );
      }
    }
  }
}

// ========================================
// TERMINATION SIGNALS
// ========================================

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// ========================================
// START ONLY WHEN EXECUTED DIRECTLY
// ========================================

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startServer();
}
