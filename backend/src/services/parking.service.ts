import { prisma } from "../config/prisma";

import {
  ParkingEntryInput,
  ParkingExitInput,
} from "../validators/parking.validator";

import { calculateParkingFee } from "./parking-fee.service";

/**
 * Starts a parking session after validating:
 * - facility
 * - vehicle
 * - linked tag
 * - tag status
 * - wallet
 * - absence of another open parking session
 */
export async function startParkingSession(
  input: ParkingEntryInput
) {
  const facility = await prisma.parkingFacility.findUnique({
    where: {
      facilityId: input.facilityId,
    },
  });

  if (!facility) {
    throw new Error("FACILITY_NOT_FOUND");
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      plateNumber: input.plateNumber,
    },
    include: {
      tag: true,
      owner: {
        include: {
          wallet: true,
        },
      },
    },
  });

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  if (!vehicle.tag) {
    throw new Error("VEHICLE_TAG_NOT_LINKED");
  }

  if (vehicle.tag.tagId !== input.tagId) {
    throw new Error("VEHICLE_TAG_MISMATCH");
  }

  if (vehicle.tag.status !== "ACTIVE") {
    throw new Error("VEHICLE_TAG_INACTIVE");
  }

  if (!vehicle.owner.wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  /*
   * A vehicle cannot start another session while
   * an earlier session remains open.
   *
   * Only CLOSED means the previous parking visit
   * has fully ended.
   */
  const existingSession = await prisma.parkingSession.findFirst({
    where: {
      vehicleId: vehicle.vehicleId,
      status: {
        not: "CLOSED",
      },
    },
  });

  if (existingSession) {
    throw new Error("ACTIVE_SESSION_EXISTS");
  }

  const session = await prisma.parkingSession.create({
    data: {
      vehicleId: vehicle.vehicleId,
      facilityId: facility.facilityId,
      entryTime: new Date(),
      status: "ACTIVE",
    },

    select: {
      sessionId: true,
      entryTime: true,
      status: true,
      facilityId: true,

      vehicle: {
        select: {
          vehicleId: true,
          plateNumber: true,
          make: true,
          model: true,
        },
      },
    },
  });

  return {
    session,
    walletBalance: vehicle.owner.wallet.balance,
    currency: "RWF",
    gateAction: "OPEN",
  };
}

/**
 * Ends an existing parking session.
 *
 * Main flow:
 *
 * ACTIVE
 *   ↓
 * FEE_CALCULATED
 *   ↓
 * enough balance?
 *
 * YES:
 * PAID
 *   ↓
 * CLOSED
 *
 * NO:
 * PAYMENT_PENDING
 *   ↓
 * AWAITING_RECHARGE
 */
export async function endParkingSession(
  input: ParkingExitInput
) {
  const facility = await prisma.parkingFacility.findUnique({
    where: {
      facilityId: input.facilityId,
    },
  });

  if (!facility) {
    throw new Error("FACILITY_NOT_FOUND");
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      plateNumber: input.plateNumber,
    },

    include: {
      tag: true,

      owner: {
        include: {
          wallet: true,
        },
      },
    },
  });

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  if (!vehicle.tag) {
    throw new Error("VEHICLE_TAG_NOT_LINKED");
  }

  if (vehicle.tag.tagId !== input.tagId) {
    throw new Error("VEHICLE_TAG_MISMATCH");
  }

  if (vehicle.tag.status !== "ACTIVE") {
    throw new Error("VEHICLE_TAG_INACTIVE");
  }

  if (!vehicle.owner.wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  /*
   * An exit can be retried when the user previously
   * reached the gate but had insufficient funds.
   */
  const session = await prisma.parkingSession.findFirst({
    where: {
      vehicleId: vehicle.vehicleId,
      facilityId: facility.facilityId,

      status: {
        in: [
          "ACTIVE",
          "FEE_CALCULATED",
          "PAYMENT_PENDING",
          "AWAITING_RECHARGE",
        ],
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  if (!session) {
    throw new Error("ACTIVE_SESSION_NOT_FOUND");
  }

  if (!session.entryTime) {
    throw new Error("SESSION_ENTRY_TIME_MISSING");
  }

  /*
   * If the driver already attempted to exit and the
   * fee was calculated, we must NOT increase the fee
   * while they are waiting to recharge.
   *
   * The original exit time and fee are therefore locked.
   */
  const hasLockedFee =
    session.fee !== null &&
    session.exitTime !== null &&
    (
      session.status === "FEE_CALCULATED" ||
      session.status === "PAYMENT_PENDING" ||
      session.status === "AWAITING_RECHARGE"
    );

  const exitTime = hasLockedFee
    ? session.exitTime!
    : new Date();

  let feeResult;

  if (hasLockedFee) {
    const totalMinutes = Math.ceil(
      (exitTime.getTime() - session.entryTime.getTime()) /
        (1000 * 60)
    );

    feeResult = {
      totalMinutes,
      fullDays: Math.floor(totalMinutes / 1440),
      remainingMinutes: totalMinutes % 1440,
      totalFee: session.fee!,
      currency: "RWF",
    };
  } else {
    feeResult = await calculateParkingFee(
      facility.facilityId,
      session.entryTime,
      exitTime
    );
  }

  /*
   * FREE PARKING
   *
   * No Transaction record is created because no money
   * actually moves.
   */
  if (feeResult.totalFee === 0) {
    const closedSession = await prisma.$transaction(
      async (tx) => {
        await tx.parkingSession.update({
          where: {
            sessionId: session.sessionId,
          },

          data: {
            fee: 0,
            status: "FEE_CALCULATED",
          },
        });

        await tx.parkingSession.update({
          where: {
            sessionId: session.sessionId,
          },

          data: {
            status: "PAID",
          },
        });

        return tx.parkingSession.update({
          where: {
            sessionId: session.sessionId,
          },

          data: {
            exitTime,
            fee: 0,
            status: "CLOSED",
          },
        });
      }
    );

    return {
      paymentRequired: false,
      session: closedSession,
      transaction: null,
      walletBalance: vehicle.owner.wallet.balance,
      fee: feeResult,
      currency: "RWF",
      gateAction: "OPEN",
    };
  }

  /*
   * PAID PARKING
   *
   * Wallet deduction, payment transaction and
   * ParkingSession changes happen in one database
   * transaction.
   */
  const result = await prisma.$transaction(async (tx) => {
    /*
     * On the first exit attempt, lock both the fee
     * and the exit time.
     *
     * If this is a retry, these values remain unchanged.
     */
    if (!hasLockedFee) {
      await tx.parkingSession.update({
        where: {
          sessionId: session.sessionId,
        },

        data: {
          fee: feeResult.totalFee,
          exitTime,
          status: "FEE_CALCULATED",
        },
      });
    }

    /*
     * Only deduct the parking fee if the wallet
     * currently has enough money.
     *
     * This condition is checked by PostgreSQL during
     * the update itself.
     */
    const deduction = await tx.wallet.updateMany({
      where: {
        walletId: vehicle.owner.wallet!.walletId,

        balance: {
          gte: feeResult.totalFee,
        },
      },

      data: {
        balance: {
          decrement: feeResult.totalFee,
        },
      },
    });

    /*
     * INSUFFICIENT BALANCE
     */
    if (deduction.count === 0) {
      /*
       * FEE_CALCULATED → PAYMENT_PENDING
       */
      await tx.parkingSession.update({
        where: {
          sessionId: session.sessionId,
        },

        data: {
          status: "PAYMENT_PENDING",
        },
      });

      /*
       * Create or update the pending PARKING_FEE
       * transaction.
       *
       * parkingSessionId is unique, preventing
       * duplicate payment transactions.
       */
      const pendingTransaction =
        await tx.transaction.upsert({
          where: {
            parkingSessionId: session.sessionId,
          },

          update: {
            amount: feeResult.totalFee,
            status: "PENDING",
          },

          create: {
            walletId: vehicle.owner.wallet!.walletId,
            parkingSessionId: session.sessionId,
            amount: feeResult.totalFee,
            type: "PARKING_FEE",
            status: "PENDING",
          },
        });

      /*
       * PAYMENT_PENDING → AWAITING_RECHARGE
       */
      const waitingSession =
        await tx.parkingSession.update({
          where: {
            sessionId: session.sessionId,
          },

          data: {
            status: "AWAITING_RECHARGE",
          },
        });

      const wallet = await tx.wallet.findUnique({
        where: {
          walletId: vehicle.owner.wallet!.walletId,
        },

        select: {
          balance: true,
        },
      });

      return {
        paymentRequired: true,
        session: waitingSession,
        transaction: pendingTransaction,
        walletBalance: wallet?.balance ?? 0,
      };
    }

    /*
     * PAYMENT SUCCESSFUL
     *
     * Fetch the wallet after deduction.
     */
    const updatedWallet =
      await tx.wallet.findUniqueOrThrow({
        where: {
          walletId: vehicle.owner.wallet!.walletId,
        },

        select: {
          walletId: true,
          balance: true,
        },
      });

    /*
     * Record the successful parking payment.
     *
     * If a PENDING transaction already exists from
     * an earlier attempt, it becomes COMPLETED.
     */
    const completedTransaction =
      await tx.transaction.upsert({
        where: {
          parkingSessionId: session.sessionId,
        },

        update: {
          amount: feeResult.totalFee,
          status: "COMPLETED",
        },

        create: {
          walletId: vehicle.owner.wallet!.walletId,
          parkingSessionId: session.sessionId,
          amount: feeResult.totalFee,
          type: "PARKING_FEE",
          status: "COMPLETED",
        },
      });

    /*
     * FEE_CALCULATED / AWAITING_RECHARGE → PAID
     */
    await tx.parkingSession.update({
      where: {
        sessionId: session.sessionId,
      },

      data: {
        status: "PAID",
      },
    });

    /*
     * PAID → CLOSED
     */
    const closedSession =
      await tx.parkingSession.update({
        where: {
          sessionId: session.sessionId,
        },

        data: {
          /*
           * Keep the original locked exit time.
           */
          exitTime,
          fee: feeResult.totalFee,
          status: "CLOSED",
        },
      });

    return {
      paymentRequired: false,
      session: closedSession,
      transaction: completedTransaction,
      walletBalance: updatedWallet.balance,
    };
  });

  /*
   * Driver needs to recharge before being allowed
   * through the exit gate.
   */
  if (result.paymentRequired) {
    return {
      ...result,

      fee: feeResult,

      shortfall: Math.max(
        feeResult.totalFee - result.walletBalance,
        0
      ),

      currency: "RWF",
      gateAction: "DENY",
    };
  }

  /*
   * Payment completed successfully.
   */
  return {
    ...result,
    fee: feeResult,
    currency: "RWF",
    gateAction: "OPEN",
  };
}

export async function getParkingHistory(
  ownerId: string
) {
  const sessions = await prisma.parkingSession.findMany({
    where: {
      vehicle: {
        ownerId,
      },
    },

    select: {
      sessionId: true,
      entryTime: true,
      exitTime: true,
      fee: true,
      status: true,

      facility: {
        select: {
          facilityId: true,
          name: true,
          location: true,
        },
      },

      vehicle: {
        select: {
          vehicleId: true,
          plateNumber: true,
          make: true,
          model: true,
        },
      },

      transaction: {
        select: {
          transactionId: true,
          amount: true,
          type: true,
          status: true,
          createdAt: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return sessions;
}