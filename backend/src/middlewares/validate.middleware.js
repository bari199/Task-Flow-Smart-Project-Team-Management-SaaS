export const validate = (schema) => {
  return (req, res, next) => {
    console.log("1. Validate middleware called");
    console.log("2. Request body:", req.body);

    const result = schema.safeParse(req.body);

    if (!result.success) {
      console.log("3. Validation failed:", result.error.issues);

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req._validatedBody = result.data;

    console.log("4. Validated body:", req._validatedBody);

    next();
  };
};

export function validateRequest(schema, source = "body") {
  return function (req, res, next) {
    try {
      const parsed = schema.parse(req[source]);

      req[source] = parsed;
      next();
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      next(error);
    }
  };
}
