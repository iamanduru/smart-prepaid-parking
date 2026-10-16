-- CreateEnum
CREATE TYPE "ParkingSessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'FEE_CALCULATED', 'PAYMENT_PENDING', 'AWAITING_RECHARGE', 'PAID', 'CLOSED');

-- CreateTable
CREATE TABLE "ParkingSession" (
    "sessionId" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3),
    "exitTime" TIMESTAMP(3),
    "fee" INTEGER,
    "status" "ParkingSessionStatus" NOT NULL DEFAULT 'CREATED',
    "vehicleId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSession_pkey" PRIMARY KEY ("sessionId")
);

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("vehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "ParkingFacility"("facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;
