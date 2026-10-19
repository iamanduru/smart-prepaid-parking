import { describe, expect, it } from "vitest";

import {
  calculateFeeFromRates,
  ParkingRateBand,
} from "./parking-fee.service";

const rates: ParkingRateBand[] = [
  { minMinutes: 0, maxMinutes: 30, price: 0 },
  { minMinutes: 31, maxMinutes: 60, price: 500 },
  { minMinutes: 61, maxMinutes: 120, price: 1000 },
  { minMinutes: 121, maxMinutes: 180, price: 1500 },
  { minMinutes: 181, maxMinutes: 240, price: 2000 },
  { minMinutes: 241, maxMinutes: 300, price: 2500 },
  { minMinutes: 301, maxMinutes: 360, price: 3000 },
  { minMinutes: 361, maxMinutes: 420, price: 3500 },
  { minMinutes: 421, maxMinutes: 480, price: 4000 },
  { minMinutes: 481, maxMinutes: 1440, price: 10000 },
];

const entryTime = new Date("2026-10-19T08:00:00Z");

function exitAfter(
  minutes: number,
  extraSeconds = 0
) {
  return new Date(
    entryTime.getTime() +
      minutes * 60 * 1000 +
      extraSeconds * 1000
  );
}

describe("parking fee calculation", () => {
  it("charges 0 RWF for exactly 30 minutes", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(30)
    );

    expect(result.totalFee).toBe(0);
  });

  it("charges 500 RWF after exceeding 30 minutes", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(30, 1)
    );

    expect(result.totalFee).toBe(500);
  });

  it("charges 500 RWF for exactly 1 hour", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(60)
    );

    expect(result.totalFee).toBe(500);
  });

  it("charges 1000 RWF after exceeding 1 hour", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(60, 1)
    );

    expect(result.totalFee).toBe(1000);
  });

  it("charges 4000 RWF for exactly 8 hours", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(480)
    );

    expect(result.totalFee).toBe(4000);
  });

  it("charges 10000 RWF after exceeding 8 hours", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(480, 1)
    );

    expect(result.totalFee).toBe(10000);
  });

  it("charges 10000 RWF for exactly 24 hours", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(1440)
    );

    expect(result.totalFee).toBe(10000);
  });

  it("charges 11000 RWF for 26 hours", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(1560)
    );

    expect(result.totalFee).toBe(11000);
  });

  it("charges 20000 RWF for exactly 48 hours", () => {
    const result = calculateFeeFromRates(
      rates,
      entryTime,
      exitAfter(2880)
    );

    expect(result.totalFee).toBe(20000);
  });

  it("rejects an exit time before the entry time", () => {
    const invalidExit = new Date(
      entryTime.getTime() - 60 * 1000
    );

    expect(() =>
      calculateFeeFromRates(
        rates,
        entryTime,
        invalidExit
      )
    ).toThrow("INVALID_PARKING_DURATION");
  });
});