import "dotenv/config";

import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { createServer } from "node:http";

import { validateEnv } from "./src/config/env.js";
import { pool, connectDatabase } from "./src/config/database.js";
import { redis, connectRedis } from "./src/config/redis.js";

import authRoutes from "./src/routes/auth.routes.js";
import passwordRoutes from "./src/routes/password.routes.js";
import teamRoutes from "./src/routes/team.routes.js";
import oauthRoutes from "./src/routes/oauth.routes.js";
import taskCommentRoutes from "./src/routes/task-comment.routes.js";

import { configurePassport } from "./src/config/passport.js";

import {
  notFoundHandler,
  errorHandler,
} from "./src/middlewares/error.middleware.js";

import projectRoutes from "./src/routes/project.routes.js";
import taskRoutes from "./src/routes/task.routes.js";

const config = validateEnv();

const app = express();
const server = createServer(app);

const PgSessionStore = connectPgSimple(session);

export { app, server, startServer };

// Production proxy configuration
if (config.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

// Request body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
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

// Passport configuration
configurePassport();
app.use(passport.initialize());

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Task-Flow API is running",
  });
});

// Health check
app.get("/api/v1/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();

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
    console.error("Health check failed:", error);

    return res.status(503).json({
      success: false,
      message: "A required service is unavailable",
    });
  }
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/password", passwordRoutes);
app.use("/api/v1/auth", oauthRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1", projectRoutes);
app.use("/api/v1", taskRoutes);
app.use("/api/v1", taskCommentRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);
app.use(errorMiddleware);

let isShuttingDown = false;

// Graceful resource cleanup
const closeResource = async (name, closeFn) => {
  try {
    await closeFn();
    console.log(`${name} closed successfully`);
  } catch (error) {
    console.error(`Failed to close ${name}:`, error);
    throw error;
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (server.listening) {
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

    const results = await Promise.allSettled([
      closeResource("PostgreSQL pool", () => pool.end()),
      closeResource("Redis connection", async () => {
        if (redis.isOpen) {
          await redis.quit();
        }
      }),
    ]);

    const failed = results.filter((result) => result.status === "rejected");

    if (failed.length > 0) {
      throw new Error("One or more resources failed to close");
    }

    console.log("Task-Flow shut down successfully");
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exitCode = 1;
  }
};

// Start the server
async function startServer() {
  let startupStep = "initialization";

  try {
    startupStep = "PostgreSQL connection";
    console.log("Connecting to PostgreSQL...");

    await connectDatabase();

    console.log("PostgreSQL connected successfully.");

    startupStep = "Redis connection";
    console.log("Connecting to Redis...");

    await connectRedis();

    console.log("Redis connected successfully.");

    startupStep = "HTTP server startup";
    console.log(`Starting server on port ${config.port}...`);

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
    console.error(`\nFailed during: ${startupStep}`);
    console.error("Full error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);

    process.exitCode = 1;

    try {
      await pool.end();
    } catch (cleanupError) {
      console.error("PostgreSQL cleanup failed:", cleanupError);
    }

    try {
      if (redis.isOpen) {
        await redis.quit();
      }
    } catch (cleanupError) {
      console.error("Redis cleanup failed:", cleanupError);
    }
  }
}

// Handle termination signals
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Start only when this file is executed directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startServer();
}
