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
    /*
     * First create the recharge transaction as PENDING.
     *
     * Later, when we integrate the real MoMo API,
     * this transaction will remain pending until
     * payment confirmation is received.
     */
    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.walletId,
        amount: input.amount,
        type: "RECHARGE",
        status: "PENDING",
      },
    });

    /*
     * Mock payment success.
     *
     * For now we immediately increase the wallet.
     * Real MoMo integration will replace this step.
     */
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

    /*
     * Mark the recharge transaction as completed.
     */
    const completedTransaction =
      await tx.transaction.update({
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

export async function getWalletTransactions(
  userId: string
) {
  /*
   * First identify the wallet belonging to the
   * authenticated Vehicle Owner.
   */
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId,
    },
  });

  if (!wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  /*
   * Return all transactions belonging to this wallet.
   *
   * This includes:
   * - RECHARGE
   * - PARKING_FEE
   */
  const transactions = await prisma.transaction.findMany({
    where: {
      walletId: wallet.walletId,
    },

    select: {
      transactionId: true,
      amount: true,
      type: true,
      status: true,
      createdAt: true,

      /*
       * Recharge transactions will normally have
       * parkingSession = null.
       *
       * Parking-fee transactions may include
       * the related parking-session details.
       */
      parkingSession: {
        select: {
          sessionId: true,
          entryTime: true,
          exitTime: true,
          fee: true,
          status: true,

          vehicle: {
            select: {
              plateNumber: true,
              make: true,
              model: true,
            },
          },

          facility: {
            select: {
              facilityId: true,
              name: true,
              location: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return transactions;
}