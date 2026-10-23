import { Router } from "express";

import {
  recharge,
  viewTransactions,
  viewWallet,
} from "../controllers/wallet.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/*
 * All Wallet routes require:
 * 1. A valid JWT
 * 2. VEHICLE_OWNER role
 */
router.use(authenticate);
router.use(requireRole("VEHICLE_OWNER"));

/**
 * @openapi
 * /api/wallet:
 *   get:
 *     tags:
 *       - Wallet
 *     summary: View wallet balance
 *     description: Returns the prepaid parking wallet belonging to the authenticated Vehicle Owner.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Wallet not found
 */
router.get(
  "/",
  viewWallet
);

/**
 * @openapi
 * /api/wallet/transactions:
 *   get:
 *     tags:
 *       - Wallet
 *     summary: View wallet transaction history
 *     description: Returns recharge and parking-fee transactions belonging to the authenticated Vehicle Owner.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Wallet not found
 */
router.get(
  "/transactions",
  viewTransactions
);

/**
 * @openapi
 * /api/wallet/recharge:
 *   post:
 *     tags:
 *       - Wallet
 *     summary: Recharge prepaid wallet
 *     description: Adds money to the authenticated Vehicle Owner's wallet. The current development implementation uses a mock successful payment flow; real MoMo integration will replace this later.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - phoneNumber
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 500
 *                 example: 5000
 *                 description: Recharge amount in RWF.
 *               phoneNumber:
 *                 type: string
 *                 example: "0788000000"
 *     responses:
 *       200:
 *         description: Wallet recharged successfully
 *       400:
 *         description: Invalid recharge data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Wallet not found
 */
router.post(
  "/recharge",
  recharge
);

export default router;