export const requireAuthenticatedUser = (req, res, next) => {
  const userId = req.session?.userId ?? req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  req.authenticatedUserId = userId;
  next();
};
