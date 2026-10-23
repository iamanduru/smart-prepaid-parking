import { NextFunction, Response } from "express";

import { AuthenticatedRequest } from "../middleware/auth.middleware";

import {
  getAllTransactions,
  getParkingRates,
  getSummaryReport,
  updateParkingRate,
} from "../services/admin.service";

import { createAuditLog } from "../services/audit.service";

import { updateParkingRateSchema } from "../validators/admin.validator";

export async function viewAllTransactions(
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

    const transactions = await getAllTransactions();

    return res.status(200).json({
      success: true,

      data: {
        transactions,
        currency: "RWF",
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function viewParkingRates(
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

    const rates = await getParkingRates();

    return res.status(200).json({
      success: true,

      data: {
        rates,
        currency: "RWF",
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function editParkingRate(
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

    const rawRateId = req.params.rateId;

    const rateId = Array.isArray(rawRateId)
      ? rawRateId[0]
      : rawRateId;

    if (!rateId) {
      return res.status(400).json({
        success: false,
        message: "Parking rate ID is required",
      });
    }
    const validation =
      updateParkingRateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid parking rate data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const rate = await updateParkingRate(
      rateId,
      validation.data
    );

    await createAuditLog({
      actorId: req.user.id,
      action: "PARKING_RATE_UPDATED",
      result: "SUCCESS",

      resourceType: "ParkingRate",
      resourceId: rate.rateId,

      details: {
        label: rate.label,
        price: rate.price,
        isActive: rate.isActive,
      },

      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Parking rate updated successfully",

      data: {
        rate,
        currency: "RWF",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PARKING_RATE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Parking rate not found",
      });
    }

    next(error);
  }
}

export async function generateSummaryReport(
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
    const report = await getSummaryReport();

    await createAuditLog({
      actorId: req.user.id,
      action: "ADMIN_REPORT_VIEWED",
      result: "SUCCESS",

      resourceType: "Report",
      resourceId: "summary",

      details: {
        reportType: "SYSTEM_SUMMARY",
      },

      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,

      data: {
        report,
      },
    });
  } catch (error) {
    next(error);
  }
}