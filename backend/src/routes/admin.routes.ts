import { Router } from "express";

import {
  editParkingRate,
  generateSummaryReport,
  viewAllTransactions,
  viewParkingRates,
} from "../controllers/admin.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/*
 * Every Administrator route requires:
 * 1. A valid JWT
 * 2. ADMINISTRATOR role
 */
router.use(authenticate);
router.use(requireRole("ADMINISTRATOR"));

/**
 * @openapi
 * /api/admin/transactions:
 *   get:
 *     tags:
 *       - Administrator
 *     summary: View all system transactions
 *     description: Returns recharge and parking-fee transactions across the system. Administrator access only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 */
router.get(
  "/transactions",
  viewAllTransactions
);

/**
 * @openapi
 * /api/admin/parking-rates:
 *   get:
 *     tags:
 *       - Administrator
 *     summary: View parking rates
 *     description: Returns all configured parking rate bands and their associated parking facility.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parking rates returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 */
router.get(
  "/parking-rates",
  viewParkingRates
);

/**
 * @openapi
 * /api/admin/parking-rates/{rateId}:
 *   patch:
 *     tags:
 *       - Administrator
 *     summary: Update a parking rate
 *     description: Allows an Administrator to update the parking rate label, price, or active status. Time-band boundaries are not changed through this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique ID of the parking rate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:
 *                 type: integer
 *                 minimum: 0
 *                 example: 500
 *                 description: Parking charge in RWF.
 *               label:
 *                 type: string
 *                 example: Up to 1 Hour
 *               isActive:
 *                 type: boolean
 *                 example: true
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: Parking rate updated successfully
 *       400:
 *         description: Invalid parking rate data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Parking rate not found
 */
router.patch(
  "/parking-rates/:rateId",
  editParkingRate
);

/**
 * @openapi
 * /api/admin/reports/summary:
 *   get:
 *     tags:
 *       - Administrator
 *     summary: Generate system summary report
 *     description: Returns summary statistics including Vehicle Owners, registered vehicles, parking sessions, parking revenue, and wallet recharge totals.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary report generated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 */
router.get(
  "/reports/summary",
  generateSummaryReport
);

export default router;