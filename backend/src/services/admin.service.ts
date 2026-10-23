import { prisma } from "../config/prisma";
import { UpdateParkingRateInput } from "../validators/admin.validator";

export async function getAllTransactions() {
  return prisma.transaction.findMany({
    select: {
      transactionId: true,
      amount: true,
      type: true,
      status: true,
      createdAt: true,

      wallet: {
        select: {
          walletId: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      },

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
}

export async function getParkingRates() {
  return prisma.parkingRate.findMany({
    select: {
      rateId: true,
      label: true,
      minMinutes: true,
      maxMinutes: true,
      price: true,
      isActive: true,

      facility: {
        select: {
          facilityId: true,
          name: true,
          location: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },

    orderBy: [
      {
        facilityId: "asc",
      },
      {
        minMinutes: "asc",
      },
    ],
  });
}

export async function updateParkingRate(
  rateId: string,
  input: UpdateParkingRateInput
) {
  const existingRate =
    await prisma.parkingRate.findUnique({
      where: {
        rateId,
      },
    });

  if (!existingRate) {
    throw new Error("PARKING_RATE_NOT_FOUND");
  }

  return prisma.parkingRate.update({
    where: {
      rateId,
    },

    data: {
      ...(input.price !== undefined && {
        price: input.price,
      }),

      ...(input.label !== undefined && {
        label: input.label,
      }),

      ...(input.isActive !== undefined && {
        isActive: input.isActive,
      }),
    },

    select: {
      rateId: true,
      label: true,
      minMinutes: true,
      maxMinutes: true,
      price: true,
      isActive: true,
      updatedAt: true,
    },
  });
}

export async function getSummaryReport() {
  const [
    vehicleOwners,
    registeredVehicles,
    totalSessions,
    activeSessions,
    closedSessions,
    parkingRevenue,
    rechargeTotal,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "VEHICLE_OWNER",
      },
    }),

    prisma.vehicle.count(),

    prisma.parkingSession.count(),

    prisma.parkingSession.count({
      where: {
        status: {
          not: "CLOSED",
        },
      },
    }),

    prisma.parkingSession.count({
      where: {
        status: "CLOSED",
      },
    }),

    prisma.transaction.aggregate({
      where: {
        type: "PARKING_FEE",
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.transaction.aggregate({
      where: {
        type: "RECHARGE",
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    vehicleOwners,
    registeredVehicles,
    parkingSessions: {
      total: totalSessions,
      open: activeSessions,
      closed: closedSessions,
    },

    financials: {
      parkingRevenue:
        parkingRevenue._sum.amount ?? 0,

      walletRecharges:
        rechargeTotal._sum.amount ?? 0,

      currency: "RWF",
    },
  };
}