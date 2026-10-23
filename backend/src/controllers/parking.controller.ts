import {
  NextFunction,
  Request,
  Response,
} from "express";

import { AuthenticatedRequest } from "../middleware/auth.middleware";

import {
  endParkingSession,
  getParkingHistory,
  startParkingSession,
} from "../services/parking.service";

import { createAuditLog } from "../services/audit.service";

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
    const validation =
      parkingEntrySchema.safeParse(req.body);

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

    await createAuditLog({
      actorId: null,
      action: "PARKING_ENTRY",
      result: "SUCCESS",

      resourceType: "ParkingSession",
      resourceId: result.session.sessionId,

      details: {
        plateNumber:
          result.session.vehicle.plateNumber,
        facilityId:
          result.session.facilityId,
        walletBalance:
          result.walletBalance,
        currency: "RWF",
        gateAction: result.gateAction,
      },

      ipAddress: req.ip,
    });

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
          message:
            "Vehicle identification failed",
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
        await createAuditLog({
          actorId: null,
          action: "PARKING_ENTRY",
          result: "FAILED",

          resourceType: "ParkingSession",

          details: {
            plateNumber:
              typeof req.body?.plateNumber ===
              "string"
                ? req.body.plateNumber
                : "unknown",

            facilityId:
              typeof req.body?.facilityId ===
              "string"
                ? req.body.facilityId
                : "unknown",

            reason: error.message,
            gateAction: "DENY",
          },

          ipAddress: req.ip,
        });

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
    const validation =
      parkingExitSchema.safeParse(req.body);

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

    if (result.paymentRequired) {
      await createAuditLog({
        actorId: null,
        action: "PARKING_PAYMENT_PENDING",
        result: "FAILED",

        resourceType: "ParkingSession",
        resourceId: result.session.sessionId,

        details: {
          plateNumber:
            validation.data.plateNumber,

          facilityId:
            validation.data.facilityId,

          fee: result.fee.totalFee,

          walletBalance:
            result.walletBalance,

          shortfall:
            "shortfall" in result
              ? result.shortfall
              : 0,

          currency: "RWF",
          gateAction: "DENY",
        },

        ipAddress: req.ip,
      });

      return res.status(402).json({
        success: false,
        message:
          "Insufficient wallet balance. Recharge is required before exit.",
        data: result,
      });
    }

 
    if (
      result.transaction &&
      result.fee.totalFee > 0
    ) {
      await createAuditLog({
        actorId: null,
        action: "PARKING_PAYMENT_COMPLETED",
        result: "SUCCESS",

        resourceType: "Transaction",
        resourceId:
          result.transaction.transactionId,

        details: {
          sessionId:
            result.session.sessionId,

          amount:
            result.fee.totalFee,

          currency: "RWF",

          walletBalance:
            result.walletBalance,
        },

        ipAddress: req.ip,
      });
    }

    await createAuditLog({
      actorId: null,
      action: "PARKING_EXIT",
      result: "SUCCESS",

      resourceType: "ParkingSession",
      resourceId: result.session.sessionId,

      details: {
        plateNumber:
          validation.data.plateNumber,

        facilityId:
          validation.data.facilityId,

        totalMinutes:
          result.fee.totalMinutes,

        fee:
          result.fee.totalFee,

        currency: "RWF",
        gateAction: result.gateAction,
      },

      ipAddress: req.ip,
    });

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
          message:
            "Vehicle identification failed",
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
        await createAuditLog({
          actorId: null,
          action: "PARKING_EXIT",
          result: "FAILED",

          resourceType: "ParkingSession",

          details: {
            plateNumber:
              typeof req.body?.plateNumber ===
              "string"
                ? req.body.plateNumber
                : "unknown",

            facilityId:
              typeof req.body?.facilityId ===
              "string"
                ? req.body.facilityId
                : "unknown",

            reason: error.message,
            gateAction: "DENY",
          },

          ipAddress: req.ip,
        });

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

export async function parkingHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const history =
      await getParkingHistory(req.user.id);

    return res.status(200).json({
      success: true,

      data: {
        history,
        currency: "RWF",
      },
    });
  } catch (error) {
    next(error);
  }
}