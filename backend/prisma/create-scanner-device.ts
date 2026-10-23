import "dotenv/config";

import { prisma } from "../src/config/prisma";

import {
  generateScannerApiKey,
  hashScannerApiKey,
} from "../src/utils/scanner-key";

interface ScannerArguments {
  code?: string;
  name?: string;
  facility?: string;
}

function parseArguments(): ScannerArguments {
  const args = process.argv.slice(2);

  const result: ScannerArguments = {};

  /*
   * First support named arguments:
   *
   * --code GATE-ENTRY-001
   * --name "Main Gate Scanner"
   * --facility default-facility
   */
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];

    if (
      argument === "--code" &&
      args[i + 1]
    ) {
      result.code = args[++i];
      continue;
    }

    if (
      argument === "--name" &&
      args[i + 1]
    ) {
      result.name = args[++i];
      continue;
    }

    if (
      argument === "--facility" &&
      args[i + 1]
    ) {
      result.facility = args[++i];
    }
  }

  /*
   * Some npm/Windows combinations may strip
   * the option names and forward only the
   * positional values.
   *
   * Example:
   *
   * GATE-ENTRY-001
   * Main Gate Scanner
   * default-facility
   */
  if (!result.code && args[0]) {
    result.code = args[0];
  }

  if (!result.name && args[1]) {
    result.name = args[1];
  }

  if (!result.facility && args[2]) {
    result.facility = args[2];
  }

  return result;
}

async function main() {
  const args = parseArguments();

  if (!args.code) {
    throw new Error(
      "Scanner device code is required."
    );
  }

  if (!args.name) {
    throw new Error(
      "Scanner device name is required."
    );
  }

  const facilityId =
    args.facility ??
    "default-facility";

  /*
   * Make sure the target parking facility
   * actually exists.
   */
  const facility =
    await prisma.parkingFacility.findUnique({
      where: {
        facilityId,
      },
    });

  if (!facility) {
    throw new Error(
      `Parking facility "${facilityId}" does not exist.`
    );
  }

  /*
   * Human-readable device codes must remain
   * unique.
   */
  const existingDevice =
    await prisma.scannerDevice.findUnique({
      where: {
        deviceCode: args.code,
      },
    });

  if (existingDevice) {
    throw new Error(
      `Scanner device "${args.code}" already exists.`
    );
  }

  /*
   * Generate a cryptographically random
   * scanner credential.
   */
  const apiKey =
    generateScannerApiKey();

  /*
   * Only the SHA-256 hash is persisted.
   *
   * The plaintext API key is shown once
   * after successful provisioning.
   */
  const apiKeyHash =
    hashScannerApiKey(apiKey);

  const device =
    await prisma.scannerDevice.create({
      data: {
        deviceCode: args.code,
        name: args.name,
        facilityId,
        apiKeyHash,
      },

      select: {
        deviceId: true,
        deviceCode: true,
        name: true,
        facilityId: true,
        status: true,
        createdAt: true,
      },
    });

  console.log("");
  console.log(
    "Scanner device created successfully."
  );

  console.log("");
  console.log("Device ID:");
  console.log(device.deviceId);

  console.log("");
  console.log("Device Code:");
  console.log(device.deviceCode);

  console.log("");
  console.log("Device Name:");
  console.log(device.name);

  console.log("");
  console.log("Facility:");
  console.log(device.facilityId);

  console.log("");
  console.log("Status:");
  console.log(device.status);

  console.log("");
  console.log(
    "IMPORTANT: Scanner API key"
  );

  console.log(
    "Store this securely. It will not be shown again."
  );

  console.log("");
  console.log(apiKey);

  console.log("");
  console.log(
    "Only the hashed API key has been stored in the database."
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to create scanner device:",
      error instanceof Error
        ? error.message
        : error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });