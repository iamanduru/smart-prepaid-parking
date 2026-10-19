import { prisma } from "../config/prisma";
import { RechargeWalletInput } from "../validators/wallet.validator";

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId,
    },
    select: {
      walletId: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  return wallet;
}

export async function rechargeWallet(
  userId: string,
  input: RechargeWalletInput
) {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId,
    },
  });

  if (!wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.walletId,
        amount: input.amount,
        type: "RECHARGE",
        status: "PENDING",
      },
    });

    const updatedWallet = await tx.wallet.update({
      where: {
        walletId: wallet.walletId,
      },
      data: {
        balance: {
          increment: input.amount,
        },
      },
      select: {
        walletId: true,
        balance: true,
        updatedAt: true,
      },
    });

    const completedTransaction = await tx.transaction.update({
      where: {
        transactionId: transaction.transactionId,
      },
      data: {
        status: "COMPLETED",
      },
      select: {
        transactionId: true,
        amount: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      wallet: updatedWallet,
      transaction: completedTransaction,
    };
  });

  return result;
}