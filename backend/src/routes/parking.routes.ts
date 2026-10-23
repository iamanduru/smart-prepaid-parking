import { Router } from "express";

import {
  parkingEntry,
  parkingExit,
  parkingHistory,
} from "../controllers/parking.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/**
 * @openapi
 * /api/parking/entry:
 *   post:
 *     tags:
 *       - Parking
 *     summary: Start a parking session
 *     description: Verifies the parking facility, registered vehicle, linked vehicle tag, wallet, and existing sessions before creating an ACTIVE parking session and returning an OPEN gate action.
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
 *                 example: RAC123A
 *               tagId:
 *                 type: string
 *                 example: TAG-RAC123A-001
 *               facilityId:
 *                 type: string
 *                 example: default-facility
 *     responses:
 *       201:
 *         description: Parking session started successfully
 *       400:
 *         description: Invalid parking entry data
 *       403:
 *         description: Vehicle identification failed, tag inactive, or wallet missing
 *       404:
 *         description: Vehicle or parking facility not found
 *       409:
 *         description: Vehicle already has an open parking session
 */
router.post(
  "/entry",
  parkingEntry
);

/**
 * @openapi
 * /api/parking/exit:
 *   post:
 *     tags:
 *       - Parking
 *     summary: End a parking session
 *     description: Verifies the vehicle and tag, retrieves the open parking session, calculates the parking fee, attempts wallet deduction, records the parking-fee transaction, and returns an OPEN or DENY gate action.
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
 *                 example: RAC123A
 *               tagId:
 *                 type: string
 *                 example: TAG-RAC123A-001
 *               facilityId:
 *                 type: string
 *                 example: default-facility
 *     responses:
 *       200:
 *         description: Parking payment completed and exit granted
 *       400:
 *         description: Invalid parking exit data or duration
 *       402:
 *         description: Insufficient wallet balance; recharge required before exit
 *       403:
 *         description: Vehicle identification failed, tag inactive, or wallet missing
 *       404:
 *         description: Vehicle, facility, or open parking session not found
 */
router.post(
  "/exit",
  parkingExit
);

/**
 * @openapi
 * /api/parking/history:
 *   get:
 *     tags:
 *       - Parking
 *     summary: View parking history
 *     description: Returns parking sessions belonging only to vehicles owned by the authenticated Vehicle Owner.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parking history returned successfully
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