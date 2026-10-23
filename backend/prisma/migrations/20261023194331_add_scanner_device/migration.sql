-- CreateEnum
CREATE TYPE "ScannerDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "ScannerDevice" (
    "deviceId" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "status" "ScannerDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "facilityId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerDevice_pkey" PRIMARY KEY ("deviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScannerDevice_deviceCode_key" ON "ScannerDevice"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerDevice_apiKeyHash_key" ON "ScannerDevice"("apiKeyHash");

-- CreateIndex
CREATE INDEX "ScannerDevice_facilityId_idx" ON "ScannerDevice"("facilityId");

-- CreateIndex
CREATE INDEX "ScannerDevice_status_idx" ON "ScannerDevice"("status");

-- AddForeignKey
ALTER TABLE "ScannerDevice" ADD CONSTRAINT "ScannerDevice_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "ParkingFacility"("facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;
