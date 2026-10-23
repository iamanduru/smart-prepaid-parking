import {
  NextFunction,
  Request,
  Response,
} from "express";

import { prisma } from "../config/prisma";

import {
  hashScannerApiKey,
} from "../utils/scanner-key";

export interface ScannerAuthenticatedRequest
  extends Request {
  scannerDevice?: {
    deviceId: string;
    deviceCode: string;
    name: string;
    facilityId: string;
    status: "ACTIVE" | "INACTIVE";
  };
}

export async function authenticateScanner(
  req: ScannerAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    /*
     * Scanner credentials are supplied through
     * a dedicated HTTP header.
     *
     * Never accept the scanner key from:
     * - query parameters
     * - request body
     * - URL path
     *
     * Those locations are more likely to end up
     * in logs and browser/server histories.
     */
    const apiKey =
      req.header("X-Scanner-Key");

    if (
      !apiKey ||
      !apiKey.startsWith("spk_")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Scanner authentication required",
        gateAction: "DENY",
      });
    }

    /*
     * Hash the supplied credential using the
     * exact same algorithm used when the
     * scanner was provisioned.
     */
    const apiKeyHash =
      hashScannerApiKey(apiKey);

    const scannerDevice =
      await prisma.scannerDevice.findUnique({
        where: {
          apiKeyHash,
        },

        select: {
          deviceId: true,
          deviceCode: true,
          name: true,
          facilityId: true,
          status: true,
        },
      });

    /*
     * Deliberately use the same response for:
     *
     * - unknown key
     * - incorrect key
     * - inactive scanner
     *
     * This avoids exposing unnecessary
     * information to an attacker.
     */
    if (
      !scannerDevice ||
      scannerDevice.status !== "ACTIVE"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid scanner credentials",
        gateAction: "DENY",
      });
    }

    /*
     * A scanner belonging to Facility A must
     * not be able to operate the gate of
     * Facility B.
     */
    const requestedFacilityId =
      req.body?.facilityId;

    if (
      typeof requestedFacilityId ===
        "string" &&
      requestedFacilityId !==
        scannerDevice.facilityId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Scanner is not authorized for this parking facility",
        gateAction: "DENY",
      });
    }

    /*
     * Make the authenticated device available
     * to downstream controllers.
     */
    req.scannerDevice =
      scannerDevice;

    /*
     * Record when this scanner last successfully
     * authenticated.
     *
     * The API key itself is never logged or
     * written back to the database.
     */
    await prisma.scannerDevice.update({
      where: {
        deviceId:
          scannerDevice.deviceId,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    next();
  } catch (error) {
    next(error);
  }
}