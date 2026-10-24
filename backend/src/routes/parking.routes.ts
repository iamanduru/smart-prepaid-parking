import { Router } from "express";

import {
  parkingEntry,
  parkingExit,
  parkingHistory,
} from "../controllers/parking.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requireRole,
} from "../middleware/role.middleware";

import {
  authenticateScanner,
} from "../middleware/scanner-auth.middleware";

import {
  scannerDeviceRateLimiter,
  scannerIpRateLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

/**
 * @openapi
 * /api/parking/entry:
 *   post:
 *     tags:
 *       - Parking
 *     summary: Start a parking session
 *     description: >
 *       Authenticates a registered parking scanner,
 *       verifies the vehicle and linked tag, checks
 *       the parking facility, creates an active
 *       parking session, and determines whether the
 *       entry gate should open.
 *
 *       Scanner requests are protected by both
 *       pre-authentication IP rate limiting and
 *       authenticated per-device rate limiting.
 *
 *     security:
 *       - scannerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plateNumber
 *               - tagId
 *               - facilityId
 *             properties:
 *               plateNumber:
 *                 type: string
 *                 example: RSC001A
 *               tagId:
 *                 type: string
 *                 example: TAG-SCANNER-001
 *               facilityId:
 *                 type: string
 *                 example: default-facility
 *
 *     responses:
 *       201:
 *         description: Parking session created and gate opened
 *       400:
 *         description: Invalid parking entry data
 *       401:
 *         description: Missing, invalid, or inactive scanner credentials
 *       403:
 *         description: Scanner not authorized for facility or vehicle verification failed
 *       404:
 *         description: Parking facility or vehicle not found
 *       409:
 *         description: Vehicle already has an open parking session
 *       429:
 *         description: Scanner request rate limit exceeded
 */
router.post(
  "/entry",

  /*
   * First protect the authentication layer
   * against excessive requests from one
   * network source.
   */
  scannerIpRateLimiter,

  /*
   * Then authenticate the physical scanner.
   */
  authenticateScanner,

  /*
   * Finally apply a quota to the authenticated
   * scanner itself using its deviceId.
   */
  scannerDeviceRateLimiter,

  parkingEntry
);

/**
 * @openapi
 * /api/parking/exit:
 *   post:
 *     tags:
 *       - Parking
 *     summary: End a parking session
 *     description: >
 *       Authenticates a registered scanner,
 *       verifies the vehicle and tag, retrieves
 *       the parking session, calculates the fee,
 *       processes payment when required, closes
 *       the session, and determines whether the
 *       exit gate should open.
 *
 *       Scanner requests are protected by both
 *       IP-based and authenticated device-based
 *       rate limits.
 *
 *     security:
 *       - scannerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plateNumber
 *               - tagId
 *               - facilityId
 *             properties:
 *               plateNumber:
 *                 type: string
 *                 example: RSC001A
 *               tagId:
 *                 type: string
 *                 example: TAG-SCANNER-001
 *               facilityId:
 *                 type: string
 *                 example: default-facility
 *
 *     responses:
 *       200:
 *         description: Parking session completed and gate opened
 *       400:
 *         description: Invalid parking exit data
 *       401:
 *         description: Missing, invalid, or inactive scanner credentials
 *       402:
 *         description: Insufficient wallet balance
 *       403:
 *         description: Scanner not authorized for facility or vehicle verification failed
 *       404:
 *         description: Facility, vehicle, or open parking session not found
 *       429:
 *         description: Scanner request rate limit exceeded
 *       500:
 *         description: Parking configuration or session error
 */
router.post(
  "/exit",

  scannerIpRateLimiter,

  authenticateScanner,

  scannerDeviceRateLimiter,

  parkingExit
);

/**
 * @openapi
 * /api/parking/history:
 *   get:
 *     tags:
 *       - Parking
 *     summary: View parking history
 *     description: >
 *       Returns parking sessions belonging only
 *       to the authenticated Vehicle Owner.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Parking history retrieved
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 */
router.get(
  "/history",
  authenticate,
  requireRole("VEHICLE_OWNER"),
  parkingHistory
);

export default router;