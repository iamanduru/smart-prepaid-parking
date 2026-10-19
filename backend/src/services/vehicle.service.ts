import { prisma } from "../config/prisma";
import { RegisterVehicleInput, LinkVehicleTagInput } from "../validators/vehicle.validator";

export async function registerVehicle(
  ownerId: string,
  input: RegisterVehicleInput
) {
  const existingVehicle = await prisma.vehicle.findUnique({
    where: {
      plateNumber: input.plateNumber,
    },
  });

  if (existingVehicle) {
    throw new Error("PLATE_ALREADY_REGISTERED");
  }

  return prisma.vehicle.create({
    data: {
      ownerId,
      plateNumber: input.plateNumber,
      make: input.make,
      model: input.model,
    },
    select: {
      vehicleId: true,
      plateNumber: true,
      make: true,
      model: true,
      createdAt: true,
    },
  });
}

export async function getOwnerVehicles(ownerId: string) {
  return prisma.vehicle.findMany({
    where: {
      ownerId,
    },
    select: {
      vehicleId: true,
      plateNumber: true,
      make: true,
      model: true,
      createdAt: true,

      tag: {
        select: {
          tagId: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function linkVehicleTag(
  ownerId: string,
  vehicleId: string,
  input: LinkVehicleTagInput
) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      vehicleId,
      ownerId,
    },
    include: {
      tag: true,
    },
  });

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  if (vehicle.tag) {
    throw new Error("VEHICLE_ALREADY_HAS_TAG");
  }

  const existingTag = await prisma.vehicleTag.findUnique({
    where: {
      tagId: input.tagId,
    },
  });

  if (existingTag) {
    throw new Error("TAG_ALREADY_IN_USE");
  }

  return prisma.vehicleTag.create({
    data: {
      tagId: input.tagId,
      vehicleId: vehicle.vehicleId,
    },
    select: {
      tagId: true,
      status: true,
      vehicleId: true,
      createdAt: true,
    },
  });
}