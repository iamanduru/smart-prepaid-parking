import { NextFunction, Response } from "express";

import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  getWallet,
  rechargeWallet,
} from "../services/wallet.service";
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

    const validation = rechargeWalletSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid recharge data",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await rechargeWallet(
      req.user.id,
      validation.data
    );

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