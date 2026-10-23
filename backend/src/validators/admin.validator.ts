import { z } from "zod";

export const updateParkingRateSchema = z.object({
  price: z
    .number()
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative")
    .max(1000000, "Price is too high")
    .optional(),

  label: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  isActive: z.boolean().optional(),
}).refine(
  (data) =>
    data.price !== undefined ||
    data.label !== undefined ||
    data.isActive !== undefined,
  {
    message: "At least one field must be updated",
  }
);

export type UpdateParkingRateInput = z.infer<
  typeof updateParkingRateSchema
>;