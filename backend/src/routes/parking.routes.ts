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
 *         description: >
 *           Parking session successfully created
 *           and the entry gate may open.
 *
 *       400:
 *         description: Invalid parking entry data
 *
 *       401:
 *         description: >
 *           Scanner authentication is missing,
 *           invalid, or the scanner device is
 *           inactive.
 *
 *       403:
 *         description: >
 *           Scanner is not authorized for the
 *           requested facility or vehicle
 *           verification failed.
 *
 *       404:
 *         description: >
 *           Parking facility or vehicle not found.
 *
 *       409:
 *         description: >
 *           Vehicle already has an open parking
 *           session.
 */
router.post(
  "/entry",
  authenticateScanner,
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
 *       Authenticates a registered parking scanner,
 *       verifies the vehicle and tag, retrieves the
 *       open parking session, calculates the parking
 *       fee, processes payment when required, closes
 *       the session, and determines whether the exit
 *       gate should open.
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
 *         description: >
 *           Parking session successfully completed
 *           and the exit gate may open.
 *
 *       400:
 *         description: Invalid parking exit data
 *
 *       401:
 *         description: >
 *           Scanner authentication is missing,
 *           invalid, or the scanner device is
 *           inactive.
 *
 *       402:
 *         description: >
 *           Vehicle owner's wallet has insufficient
 *           balance. Recharge is required before
 *           the gate can open.
 *
 *       403:
 *         description: >
 *           Scanner is not authorized for the
 *           requested facility or vehicle
 *           verification failed.
 *
 *       404:
 *         description: >
 *           Parking facility, vehicle, or open
 *           parking session not found.
 *
 *       500:
 *         description: >
 *           Parking rates or session data are not
 *           correctly configured.
 */
router.post(
  "/exit",
  authenticateScanner,
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
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: >
 *           Authenticated user does not have the
 *           Vehicle Owner role.
 */
router.get(
  "/history",
  authenticate,
  requireRole("VEHICLE_OWNER"),
  parkingHistory
);

export default router;