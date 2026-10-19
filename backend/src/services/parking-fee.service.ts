import { prisma } from "../config/prisma";

const MINUTES_PER_DAY = 1440;

export interface ParkingRateBand {
  minMinutes: number;
  maxMinutes: number;
  price: number;
}

export function calculateFeeFromRates(
  rates: ParkingRateBand[],
  entryTime: Date,
  exitTime: Date
) {
  if (exitTime <= entryTime) {
    throw new Error("INVALID_PARKING_DURATION");
  }

  const durationMilliseconds =
    exitTime.getTime() - entryTime.getTime();

  const totalMinutes = Math.ceil(
    durationMilliseconds / (1000 * 60)
  );

  const dailyRate = rates.find(
    (rate) => rate.maxMinutes === MINUTES_PER_DAY
  );

  if (!dailyRate) {
    throw new Error("DAILY_RATE_NOT_FOUND");
  }

  const fullDays = Math.floor(
    totalMinutes / MINUTES_PER_DAY
  );

  const remainingMinutes =
    totalMinutes % MINUTES_PER_DAY;

  let totalFee = fullDays * dailyRate.price;

  if (remainingMinutes > 0) {
    const remainingRate = rates.find(
      (rate) =>
        remainingMinutes >= rate.minMinutes &&
        remainingMinutes <= rate.maxMinutes
    );

    if (!remainingRate) {
      throw new Error("PARKING_RATE_NOT_FOUND");
    }

    totalFee += remainingRate.price;
  }

  return {
    totalMinutes,
    fullDays,
    remainingMinutes,
    totalFee,
    currency: "RWF",
  };
}

export async function calculateParkingFee(
  facilityId: string,
  entryTime: Date,
  exitTime: Date
) {
  const rates = await prisma.parkingRate.findMany({
    where: {
      facilityId,
      isActive: true,
    },
    orderBy: {
      minMinutes: "asc",
    },
  });

  if (rates.length === 0) {
    throw new Error("PARKING_RATES_NOT_FOUND");
  }

  return calculateFeeFromRates(
    rates,
    entryTime,
    exitTime
  );
}