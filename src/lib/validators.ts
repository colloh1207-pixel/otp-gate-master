import { z } from "zod";

// Phone: digits only, 8-15, no leading +
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{7,14}$/, "Phone must be country code + number, digits only (e.g. 254712345678)");

export const otpSchema = z.string().trim().regex(/^\d{4,8}$/, "OTP must be 4-8 digits");

export const messageTextSchema = z.string().trim().min(1).max(4096);

export const sessionNameSchema = z.string().trim().min(1).max(80);

export const apiKeyLabelSchema = z.string().trim().min(1).max(80);

export const templateNameSchema = z.string().trim().min(1).max(80);
export const templateBodySchema = z.string().trim().min(1).max(4096);

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const sendOtpInput = z.object({
  to: phoneSchema,
  otp: otpSchema,
  app_name: z.string().trim().max(40).optional(),
});

export const sendMessageInput = z.object({
  to: phoneSchema,
  message: messageTextSchema,
});

export const bulkInput = z.object({
  numbers: z.array(phoneSchema).min(1).max(100),
  message: messageTextSchema,
  delay_ms: z.number().int().min(0).max(60_000).optional(),
});

export type SendOtpInput = z.infer<typeof sendOtpInput>;
export type SendMessageInput = z.infer<typeof sendMessageInput>;
export type BulkInput = z.infer<typeof bulkInput>;
