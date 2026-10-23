import "dotenv/config";

import { prisma } from "../src/config/prisma";

import {
  generateScannerApiKey,
  hashScannerApiKey,
} from "../src/utils/scanner-key";

async function main() {

  const deviceCode = process.argv[2];

  if (!deviceCode) {
    throw new Error(
      "Scanner device code is required."
    );
  }

  const existingDevice =
    await prisma.scannerDevice.findUnique({
      where: {
        deviceCode,
      },
    });

  if (!existingDevice) {
    throw new Error(
      `Scanner device "${deviceCode}" does not exist.`
    );
  }

  const apiKey =
    generateScannerApiKey();

  const apiKeyHash =
    hashScannerApiKey(apiKey);
  await prisma.scannerDevice.update({
    where: {
      deviceId:
        existingDevice.deviceId,
    },
    data: {
      apiKeyHash,
    },
  });

  console.log("");
  console.log(
    "Scanner API key rotated successfully."
  );

  console.log("");
  console.log("Device Code:");
  console.log(
    existingDevice.deviceCode
  );

  console.log("");
  console.log(
    "IMPORTANT: New scanner API key"
  );

  console.log(
    "The previous key is now invalid."
  );

  console.log("");
  console.log(apiKey);

  console.log("");
  console.log(
    "Only the new hash is stored in PostgreSQL."
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to rotate scanner key:",
      error instanceof Error
        ? error.message
        : error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });