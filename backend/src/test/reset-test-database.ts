import { prisma } from "../config/prisma";

function assertSafeTestDatabase() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "SAFETY STOP: Database reset is only allowed when NODE_ENV=test."
    );
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "SAFETY STOP: DATABASE_URL is missing."
    );
  }

  const parsedDatabaseUrl =
    new URL(databaseUrl);

  const schema =
    parsedDatabaseUrl.searchParams.get(
      "schema"
    );

  if (schema !== "integration_test") {
    throw new Error(
      `SAFETY STOP: Refusing to reset schema "${schema ?? "public"}". Expected "integration_test".`
    );
  }
}

export async function resetTestDatabase() {
  assertSafeTestDatabase();

  await prisma.auditLog.deleteMany();

  await prisma.transaction.deleteMany();

  await prisma.parkingSession.deleteMany();

  await prisma.vehicleTag.deleteMany();

  await prisma.scannerDevice.deleteMany();

  await prisma.parkingRate.deleteMany();

  await prisma.vehicle.deleteMany();

  await prisma.wallet.deleteMany();

  await prisma.parkingFacility.deleteMany();

  await prisma.user.deleteMany();
}