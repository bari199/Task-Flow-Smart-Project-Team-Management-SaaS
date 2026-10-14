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
