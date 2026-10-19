import { z } from "zod";

export const registerVehicleSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plate number is required")
    .max(20, "Plate number is too long")
    .transform((value) =>
      value.toUpperCase().replace(/[\s-]/g, "")
    ),

  make: z
    .string()
    .trim()
    .min(2, "Vehicle make is required")
    .max(50),

  model: z
    .string()
    .trim()
    .min(1, "Vehicle model is required")
    .max(50),
});

export type RegisterVehicleInput = z.infer<
  typeof registerVehicleSchema
>;

export const linkVehicleTagSchema = z.object({
  tagId: z
    .string()
    .trim()
    .min(3, "Tag ID is required")
    .max(100, "Tag ID is too long"),
});

export type LinkVehicleTagInput = z.infer<
  typeof linkVehicleTagSchema
>;