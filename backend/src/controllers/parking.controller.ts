import { NextFunction, Request, Response } from "express";

import { startParkingSession } from "../services/parking.service";
import { parkingEntrySchema } from "../validators/parking.validator";

export async function parkingEntry(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validation = parkingEntrySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid parking entry data",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await startParkingSession(validation.data);

    return res.status(201).json({
      success: true,
      message: "Parking session started",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { status: number; message: string }
      > = {
        FACILITY_NOT_FOUND: {
          status: 404,
          message: "Parking facility not found",
        },

        VEHICLE_NOT_FOUND: {
          status: 404,
          message: "Vehicle not registered",
        },

        VEHICLE_TAG_NOT_LINKED: {
          status: 403,
          message: "Vehicle does not have a linked tag",
        },

        VEHICLE_TAG_MISMATCH: {
          status: 403,
          message: "Vehicle identification failed",
        },

        VEHICLE_TAG_INACTIVE: {
          status: 403,
          message: "Vehicle tag is inactive",
        },

        WALLET_NOT_FOUND: {
          status: 403,
          message: "Vehicle owner does not have a wallet",
        },

        ACTIVE_SESSION_EXISTS: {
          status: 409,
          message: "Vehicle already has an active parking session",
        },
      };

      const mappedError = errors[error.message];

      if (mappedError) {
        return res.status(mappedError.status).json({
          success: false,
          message: mappedError.message,
          gateAction: "DENY",
        });
      }
    }

    next(error);
  }
}