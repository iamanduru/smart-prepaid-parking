-- CreateTable
CREATE TABLE "ParkingRate" (
    "rateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minMinutes" INTEGER NOT NULL,
    "maxMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingRate_pkey" PRIMARY KEY ("rateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingRate_facilityId_minMinutes_maxMinutes_key" ON "ParkingRate"("facilityId", "minMinutes", "maxMinutes");

-- AddForeignKey
ALTER TABLE "ParkingRate" ADD CONSTRAINT "ParkingRate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "ParkingFacility"("facilityId") ON DELETE CASCADE ON UPDATE CASCADE;
