import { z } from "zod";

export const parkingEntrySchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plate number is required")
    .max(20)
    .transform((value) =>
      value.toUpperCase().replace(/[\s-]/g, "")
    ),

  tagId: z
    .string()
    .trim()
    .min(3, "Vehicle tag is required")
    .max(100),

  facilityId: z
    .string()
    .trim()
    .min(1, "Parking facility is required"),
});

export type ParkingEntryInput = z.infer<
  typeof parkingEntrySchema
>;