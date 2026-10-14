import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(120, "Name cannot exceed 120 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
});

export const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});

export const resendOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),
});
