import { NextFunction, Response } from "express";

import { AuthenticatedRequest } from "../middleware/auth.middleware";

import {
  getWallet,
  getWalletTransactions,
  rechargeWallet,
} from "../services/wallet.service";

import { createAuditLog } from "../services/audit.service";

import { rechargeWalletSchema } from "../validators/wallet.validator";

export async function viewWallet(
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

    const wallet = await getWallet(req.user.id);

    return res.status(200).json({
      success: true,

      data: {
        wallet,
        currency: "RWF",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WALLET_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    next(error);
  }
}

export async function recharge(
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
     * Validate the requested recharge amount
     * and phone number.
     */
    const validation =
      rechargeWalletSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid recharge data",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    /*
     * Perform the wallet recharge.
     *
     * In the current development version this uses
     * our mock successful payment flow.
     */
    const result = await rechargeWallet(
      req.user.id,
      validation.data
    );

    /*
     * Record the successful recharge in the
     * security/accountability audit trail.
     */
    await createAuditLog({
      actorId: req.user.id,
      action: "WALLET_RECHARGED",
      result: "SUCCESS",

      resourceType: "Wallet",
      resourceId: result.wallet.walletId,

      details: {
        amount: result.transaction.amount,
        currency: "RWF",
        transactionId:
          result.transaction.transactionId,

        /*
         * Do not log unnecessary payment secrets.
         * The phone number is intentionally not
         * stored in the audit details here.
         */
        newBalance: result.wallet.balance,
      },

      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Wallet recharged successfully",

      data: {
        ...result,
        currency: "RWF",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WALLET_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    next(error);
  }
}

export async function viewTransactions(
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

    const transactions =
      await getWalletTransactions(req.user.id);

    return res.status(200).json({
      success: true,

      data: {
        transactions,
        currency: "RWF",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WALLET_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    next(error);
  }
}