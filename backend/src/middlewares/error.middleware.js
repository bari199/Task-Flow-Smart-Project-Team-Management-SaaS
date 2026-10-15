export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  console.error("Request error:", error.message);
  console.error("Error status:", error.status);

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.status || 500;

  return res.status(statusCode).json({
    success: false,
    message: statusCode < 500 ? error.message : "Internal server error",
  });
};

export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Server error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Internal server error" : err.message,
  });
}
