import { Router } from "express";

import {
  recharge,
  viewTransactions,
  viewWallet,
} from "../controllers/wallet.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requireRole,
} from "../middleware/role.middleware";

import {
  walletRechargeRateLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

/**
 * @openapi
 * /api/wallet:
 *   get:
 *     tags:
 *       - Wallet
 *     summary: View wallet balance
 *     description: >
 *       Returns the prepaid wallet belonging to
 *       the authenticated Vehicle Owner.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Wallet retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Wallet not found
 */
router.get(
  "/",
  authenticate,
  requireRole("VEHICLE_OWNER"),
  viewWallet
);

/**
 * @openapi
 * /api/wallet/transactions:
 *   get:
 *     tags:
 *       - Wallet
 *     summary: View wallet transactions
 *     description: >
 *       Returns recharge and parking-payment
 *       transactions belonging only to the
 *       authenticated Vehicle Owner.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Wallet not found
 */
router.get(
  "/transactions",
  authenticate,
  requireRole("VEHICLE_OWNER"),
  viewTransactions
);

/**
 * @openapi
 * /api/wallet/recharge:
 *   post:
 *     tags:
 *       - Wallet
 *     summary: Recharge prepaid wallet
 *     description: >
 *       Adds funds to the authenticated Vehicle
 *       Owner's prepaid wallet using the current
 *       development payment adapter.
 *
 *       Recharge attempts are rate-limited per
 *       authenticated user to reduce payment abuse.
 *
 *     security:
 *       - bearerAuth: []
 *
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
 *                 example: 5000
 *               phoneNumber:
 *                 type: string
 *                 example: "0788000000"
 *
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
 *       429:
 *         description: Too many wallet recharge attempts
 */
router.post(
  "/recharge",

  /*
   * Authenticate first so the limiter can
   * identify the actual user rather than
   * relying only on IP address.
   */
  authenticate,

  requireRole("VEHICLE_OWNER"),

  walletRechargeRateLimiter,

  recharge
);

export default router;