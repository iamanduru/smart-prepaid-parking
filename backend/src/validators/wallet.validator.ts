import { z } from "zod";

export const rechargeWalletSchema = z.object({
  amount: z
    .number()
    .int("Recharge amount must be a whole number")
    .min(500, "Minimum recharge amount is 500 RWF")
    .max(500000, "Recharge amount is too high"),

  phoneNumber: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(15, "Phone number is too long"),
});

export type RechargeWalletInput = z.infer<
  typeof rechargeWalletSchema
>;