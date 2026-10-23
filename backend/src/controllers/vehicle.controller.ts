import { NextFunction, Response } from "express";

import { AuthenticatedRequest } from "../middleware/auth.middleware";

import {
  getOwnerVehicles,
  linkVehicleTag,
  registerVehicle,
} from "../services/vehicle.service";

import {
  linkVehicleTagSchema,
  registerVehicleSchema,
} from "../validators/vehicle.validator";

import { createAuditLog } from "../services/audit.service";

export async function createVehicle(
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

    /*
     * Validate the request before attempting to
     * create anything in the database.
     */
    const validation = registerVehicleSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    /*
     * Register the vehicle.
     */
    const vehicle = await registerVehicle(
      req.user.id,
      validation.data
    );

    /*
     * Record the successful vehicle registration
     * in the audit trail.
     */
    await createAuditLog({
      actorId: req.user.id,
      action: "VEHICLE_REGISTERED",
      result: "SUCCESS",

      resourceType: "Vehicle",
      resourceId: vehicle.vehicleId,

      details: {
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
      },

      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle registered successfully",

      data: {
        vehicle,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PLATE_ALREADY_REGISTERED"
    ) {
      return res.status(409).json({
        success: false,
        message: "This vehicle is already registered",
      });
    }

    next(error);
  }
}

export async function listVehicles(
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

    const vehicles = await getOwnerVehicles(
      req.user.id
    );

    return res.status(200).json({
      success: true,

      data: {
        vehicles,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function attachVehicleTag(
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

    /*
     * Validate the tag data.
     */
    const validation =
      linkVehicleTagSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle tag data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    /*
     * Express route parameters may be typed as
     * string | string[], so we safely narrow it
     * to a single string.
     */
    const rawVehicleId = req.params.vehicleId;

    const vehicleId = Array.isArray(rawVehicleId)
      ? rawVehicleId[0]
      : rawVehicleId;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }

    /*
     * Link the tag to the authenticated owner's
     * vehicle.
     */
    const tag = await linkVehicleTag(
      req.user.id,
      vehicleId,
      validation.data
    );

    /*
     * Record the successful tag-linking event.
     */
    await createAuditLog({
      actorId: req.user.id,
      action: "VEHICLE_TAG_LINKED",
      result: "SUCCESS",

      resourceType: "VehicleTag",
      resourceId: tag.tagId,

      details: {
        vehicleId: tag.vehicleId,
        tagStatus: tag.status,
      },

      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle tag linked successfully",

      data: {
        tag,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "VEHICLE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "VEHICLE_ALREADY_HAS_TAG"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This vehicle already has a linked tag",
      });
    }

    if (
      error instanceof Error &&
      error.message === "TAG_ALREADY_IN_USE"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This tag is already linked to another vehicle",
      });
    }

    next(error);
  }
}