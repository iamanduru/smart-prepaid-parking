import { z } from "zod";

const vehicleIdentificationSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plate number is required")
    .max(20, "Plate number is too long")
    .transform((value) =>
      value.toUpperCase().replace(/[\s-]/g, "")
    ),

  tagId: z
    .string()
    .trim()
    .min(3, "Vehicle tag is required")
    .max(100, "Vehicle tag is too long"),

  facilityId: z
    .string()
    .trim()
    .min(1, "Parking facility is required"),
});

export const parkingEntrySchema =
  vehicleIdentificationSchema;

export const parkingExitSchema =
  vehicleIdentificationSchema;

export type ParkingEntryInput = z.infer<
  typeof parkingEntrySchema
>;

export type ParkingExitInput = z.infer<
  typeof parkingExitSchema
>;