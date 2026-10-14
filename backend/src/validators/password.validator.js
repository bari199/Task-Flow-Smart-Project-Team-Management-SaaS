import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(8).max(128),
});
