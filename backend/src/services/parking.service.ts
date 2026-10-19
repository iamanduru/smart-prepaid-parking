import { prisma } from "../config/prisma";
import { ParkingEntryInput } from "../validators/parking.validator";

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

  const existingSession = await prisma.parkingSession.findFirst({
    where: {
      vehicleId: vehicle.vehicleId,
      status: "ACTIVE",
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