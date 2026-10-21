import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  endParkingSession,
  startParkingSession,
} from "../services/parking.service";

import {
  parkingEntrySchema,
  parkingExitSchema,
} from "../validators/parking.validator";

export async function parkingEntry(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validation = parkingEntrySchema.safeParse(
      req.body
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid parking entry data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const result = await startParkingSession(
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Parking session started",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        {
          status: number;
          message: string;
        }
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
          message:
            "Vehicle does not have a linked tag",
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
          message:
            "Vehicle owner does not have a wallet",
        },

        ACTIVE_SESSION_EXISTS: {
          status: 409,
          message:
            "Vehicle already has an active parking session",
        },
      };

      const mappedError = errors[error.message];

      if (mappedError) {
        return res
          .status(mappedError.status)
          .json({
            success: false,
            message: mappedError.message,
            gateAction: "DENY",
          });
      }
    }

    next(error);
  }
}

export async function parkingExit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validation = parkingExitSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid parking exit data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const result = await endParkingSession(
      validation.data
    );

    /*
     * Wallet does not contain enough money.
     */
    if (result.paymentRequired) {
      return res.status(402).json({
        success: false,
        message:
          "Insufficient wallet balance. Recharge is required before exit.",
        data: result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Parking payment completed",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        {
          status: number;
          message: string;
        }
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
          message:
            "Vehicle does not have a linked tag",
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
          message:
            "Vehicle owner does not have a wallet",
        },

        ACTIVE_SESSION_NOT_FOUND: {
          status: 404,
          message:
            "No open parking session exists for this vehicle",
        },

        SESSION_ENTRY_TIME_MISSING: {
          status: 500,
          message:
            "Parking session data is incomplete",
        },

        INVALID_PARKING_DURATION: {
          status: 400,
          message: "Invalid parking duration",
        },

        PARKING_RATES_NOT_FOUND: {
          status: 500,
          message:
            "Parking rates are not configured",
        },

        DAILY_RATE_NOT_FOUND: {
          status: 500,
          message:
            "Daily parking rate is not configured",
        },

        PARKING_RATE_NOT_FOUND: {
          status: 500,
          message:
            "No parking rate matches this duration",
        },
      };

      const mappedError = errors[error.message];

      if (mappedError) {
        return res
          .status(mappedError.status)
          .json({
            success: false,
            message: mappedError.message,
            gateAction: "DENY",
          });
      }
    }

    next(error);
  }
}