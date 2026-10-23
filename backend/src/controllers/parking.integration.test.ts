import request from "supertest";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import app from "../app";
import { prisma } from "../config/prisma";
import { resetTestDatabase } from "../test/reset-test-database";

describe("Parking API integration tests", () => {
  /*
   * Our reset helper removes parking facilities
   * and rates as well as user data.
   *
   * Therefore each parking test needs a clean
   * parking configuration before it begins.
   */
  async function seedParkingConfiguration() {
    await prisma.parkingFacility.create({
      data: {
        facilityId: "default-facility",
        name: "Main Parking Facility",
        location: "Kigali",
      },
    });

    await prisma.parkingRate.createMany({
      data: [
        {
          label: "Free Parking",
          minMinutes: 0,
          maxMinutes: 30,
          price: 0,
          facilityId: "default-facility",
        },
        {
          label: "Up to 1 Hour",
          minMinutes: 31,
          maxMinutes: 60,
          price: 500,
          facilityId: "default-facility",
        },
        {
          label: "Up to 2 Hours",
          minMinutes: 61,
          maxMinutes: 120,
          price: 1000,
          facilityId: "default-facility",
        },
        {
          label: "Up to 3 Hours",
          minMinutes: 121,
          maxMinutes: 180,
          price: 1500,
          facilityId: "default-facility",
        },
        {
          label: "Up to 4 Hours",
          minMinutes: 181,
          maxMinutes: 240,
          price: 2000,
          facilityId: "default-facility",
        },
        {
          label: "Up to 5 Hours",
          minMinutes: 241,
          maxMinutes: 300,
          price: 2500,
          facilityId: "default-facility",
        },
        {
          label: "Up to 6 Hours",
          minMinutes: 301,
          maxMinutes: 360,
          price: 3000,
          facilityId: "default-facility",
        },
        {
          label: "Up to 7 Hours",
          minMinutes: 361,
          maxMinutes: 420,
          price: 3500,
          facilityId: "default-facility",
        },
        {
          label: "Up to 8 Hours",
          minMinutes: 421,
          maxMinutes: 480,
          price: 4000,
          facilityId: "default-facility",
        },
        {
          label: "Overnight",
          minMinutes: 481,
          maxMinutes: 1440,
          price: 10000,
          facilityId: "default-facility",
        },
      ],
    });
  }

  beforeEach(async () => {
    await resetTestDatabase();
    await seedParkingConfiguration();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  /*
   * Creates a complete driver setup:
   *
   * User
   *  ↓
   * Wallet
   *  ↓
   * Vehicle
   *  ↓
   * Vehicle Tag
   *
   * It returns everything needed by the
   * parking entry/exit tests.
   */
  async function createDriverSetup() {
    const email = "parking.driver@example.com";
    const password = "SecurePass123";

    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Parking Test Driver",
        email,
        phone: "0788666666",
        password,
      });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password,
      });

    const token =
      loginResponse.body.data.token as string;

    const vehicleResponse = await request(app)
      .post("/api/vehicles")
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        plateNumber: "RAC900A",
        make: "Toyota",
        model: "RAV4",
      });

    const vehicleId =
      vehicleResponse.body.data.vehicle.vehicleId;

    await request(app)
      .post(
        `/api/vehicles/${vehicleId}/tag`
      )
      .set(
        "Authorization",
        `Bearer ${token}`
      )
      .send({
        tagId: "TAG-PARKING-001",
      });

    return {
      token,
      vehicleId,
      plateNumber: "RAC900A",
      tagId: "TAG-PARKING-001",
      facilityId: "default-facility",
    };
  }

  describe("POST /api/parking/entry", () => {
    it("starts an active parking session and opens the gate", async () => {
      const driver =
        await createDriverSetup();

      const response = await request(app)
        .post("/api/parking/entry")
        .send({
          plateNumber: driver.plateNumber,
          tagId: driver.tagId,
          facilityId: driver.facilityId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data.gateAction
      ).toBe("OPEN");

      expect(
        response.body.data.session.status
      ).toBe("ACTIVE");

      /*
       * Verify the actual database session.
       */
      const session =
        await prisma.parkingSession.findFirst({
          where: {
            vehicleId: driver.vehicleId,
          },
        });

      expect(session).not.toBeNull();
      expect(session?.status).toBe("ACTIVE");
      expect(session?.entryTime).not.toBeNull();

      /*
       * Entry should produce an audit record.
       */
      const auditLog =
        await prisma.auditLog.findFirst({
          where: {
            action: "PARKING_ENTRY",
            result: "SUCCESS",
          },
        });

      expect(auditLog).not.toBeNull();

      expect(
        auditLog?.resourceId
      ).toBe(session?.sessionId);
    });

    it("rejects a second entry while the vehicle already has an open session", async () => {
      const driver =
        await createDriverSetup();

      const entryData = {
        plateNumber: driver.plateNumber,
        tagId: driver.tagId,
        facilityId: driver.facilityId,
      };

      const firstResponse =
        await request(app)
          .post("/api/parking/entry")
          .send(entryData);

      expect(firstResponse.status).toBe(201);

      const secondResponse =
        await request(app)
          .post("/api/parking/entry")
          .send(entryData);

      expect(secondResponse.status).toBe(
        409
      );

      expect(
        secondResponse.body.success
      ).toBe(false);

      expect(
        secondResponse.body.gateAction
      ).toBe("DENY");

      /*
       * There must still be only one open
       * parking session.
       */
      const sessionCount =
        await prisma.parkingSession.count();

      expect(sessionCount).toBe(1);

      /*
       * Failed entry should also be auditable.
       */
      const failedAudit =
        await prisma.auditLog.findFirst({
          where: {
            action: "PARKING_ENTRY",
            result: "FAILED",
          },
        });

      expect(failedAudit).not.toBeNull();
    });
  });

  describe("POST /api/parking/exit", () => {
    it("closes a free parking session without creating a payment transaction", async () => {
      const driver =
        await createDriverSetup();

      const entryResponse =
        await request(app)
          .post("/api/parking/entry")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      const sessionId =
        entryResponse.body.data.session
          .sessionId;

      /*
       * Instead of waiting 20 real minutes,
       * move entryTime backwards in the test
       * database.
       *
       * This simulates a 20-minute stay.
       */
      await prisma.parkingSession.update({
        where: {
          sessionId,
        },
        data: {
          entryTime: new Date(
            Date.now() - 20 * 60 * 1000
          ),
        },
      });

      const exitResponse =
        await request(app)
          .post("/api/parking/exit")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      expect(exitResponse.status).toBe(200);

      expect(
        exitResponse.body.success
      ).toBe(true);

      expect(
        exitResponse.body.data.gateAction
      ).toBe("OPEN");

      expect(
        exitResponse.body.data.fee.totalFee
      ).toBe(0);

      /*
       * Free parking should not create a
       * financial transaction.
       */
      expect(
        exitResponse.body.data.transaction
      ).toBeNull();

      const transactionCount =
        await prisma.transaction.count();

      expect(transactionCount).toBe(0);

      const session =
        await prisma.parkingSession.findUnique({
          where: {
            sessionId,
          },
        });

      expect(session?.status).toBe("CLOSED");
      expect(session?.fee).toBe(0);

      /*
       * Wallet remains untouched.
       */
      const wallet =
        await prisma.wallet.findFirst();

      expect(wallet?.balance).toBe(0);

      const exitAudit =
        await prisma.auditLog.findFirst({
          where: {
            action: "PARKING_EXIT",
            result: "SUCCESS",
          },
        });

      expect(exitAudit).not.toBeNull();
    });

    it("deducts the correct fee and closes a paid parking session", async () => {
      const driver =
        await createDriverSetup();

      /*
       * Give the driver enough money first.
       */
      const rechargeResponse =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${driver.token}`
          )
          .send({
            amount: 5000,
            phoneNumber: "0788666666",
          });

      expect(rechargeResponse.status).toBe(
        200
      );

      const entryResponse =
        await request(app)
          .post("/api/parking/entry")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      const sessionId =
        entryResponse.body.data.session
          .sessionId;

      /*
       * Simulate approximately 95 minutes.
       *
       * 61–120 minutes = 1000 RWF.
       */
      await prisma.parkingSession.update({
        where: {
          sessionId,
        },
        data: {
          entryTime: new Date(
            Date.now() - 95 * 60 * 1000
          ),
        },
      });

      const exitResponse =
        await request(app)
          .post("/api/parking/exit")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      expect(exitResponse.status).toBe(200);

      expect(
        exitResponse.body.data.fee.totalFee
      ).toBe(1000);

      expect(
        exitResponse.body.data.gateAction
      ).toBe("OPEN");

      /*
       * 5000 - 1000 = 4000.
       */
      const wallet =
        await prisma.wallet.findFirst();

      expect(wallet?.balance).toBe(4000);

      const session =
        await prisma.parkingSession.findUnique({
          where: {
            sessionId,
          },
        });

      expect(session?.status).toBe("CLOSED");
      expect(session?.fee).toBe(1000);

      const payment =
        await prisma.transaction.findFirst({
          where: {
            parkingSessionId: sessionId,
            type: "PARKING_FEE",
          },
        });

      expect(payment).not.toBeNull();
      expect(payment?.amount).toBe(1000);

      expect(payment?.status).toBe(
        "COMPLETED"
      );

      /*
       * A real payment should generate
       * its own payment audit event.
       */
      const paymentAudit =
        await prisma.auditLog.findFirst({
          where: {
            action:
              "PARKING_PAYMENT_COMPLETED",
            result: "SUCCESS",
          },
        });

      expect(paymentAudit).not.toBeNull();
    });

    it("locks the fee when balance is insufficient and completes exit after recharge", async () => {
      const driver =
        await createDriverSetup();

      /*
       * Driver begins with only 4000 RWF.
       */
      const initialRecharge =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${driver.token}`
          )
          .send({
            amount: 4000,
            phoneNumber: "0788666666",
          });

      expect(initialRecharge.status).toBe(
        200
      );

      const entryResponse =
        await request(app)
          .post("/api/parking/entry")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      const sessionId =
        entryResponse.body.data.session
          .sessionId;

      /*
       * Simulate a 9-hour stay.
       *
       * Anything above 8 hours and within
       * 24 hours costs 10,000 RWF.
       */
      await prisma.parkingSession.update({
        where: {
          sessionId,
        },
        data: {
          entryTime: new Date(
            Date.now() - 9 * 60 * 60 * 1000
          ),
        },
      });

      /*
       * First exit attempt:
       *
       * fee     = 10,000
       * balance = 4,000
       * shortfall = 6,000
       */
      const firstExit =
        await request(app)
          .post("/api/parking/exit")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      expect(firstExit.status).toBe(402);

      expect(
        firstExit.body.success
      ).toBe(false);

      expect(
        firstExit.body.data.gateAction
      ).toBe("DENY");

      expect(
        firstExit.body.data.fee.totalFee
      ).toBe(10000);

      expect(
        firstExit.body.data.walletBalance
      ).toBe(4000);

      expect(
        firstExit.body.data.shortfall
      ).toBe(6000);

      /*
       * The wallet must NOT be partially
       * deducted.
       */
      let wallet =
        await prisma.wallet.findFirst();

      expect(wallet?.balance).toBe(4000);

      /*
       * Session should remain open and wait
       * for recharge.
       */
      const waitingSession =
        await prisma.parkingSession.findUnique({
          where: {
            sessionId,
          },
        });

      expect(
        waitingSession?.status
      ).toBe("AWAITING_RECHARGE");

      expect(
        waitingSession?.fee
      ).toBe(10000);

      expect(
        waitingSession?.exitTime
      ).not.toBeNull();

      /*
       * Save the locked exit time and fee.
       *
       * These must not change when the driver
       * comes back after recharging.
       */
      const lockedExitTime =
        waitingSession?.exitTime;

      const lockedFee =
        waitingSession?.fee;

      const pendingPayment =
        await prisma.transaction.findFirst({
          where: {
            parkingSessionId: sessionId,
            type: "PARKING_FEE",
          },
        });

      expect(pendingPayment).not.toBeNull();

      expect(
        pendingPayment?.status
      ).toBe("PENDING");

      expect(
        pendingPayment?.amount
      ).toBe(10000);

      const pendingTransactionId =
        pendingPayment?.transactionId;

      /*
       * Confirm the failed-payment audit event.
       */
      const pendingAudit =
        await prisma.auditLog.findFirst({
          where: {
            action:
              "PARKING_PAYMENT_PENDING",
          },
        });

      expect(pendingAudit).not.toBeNull();

      /*
       * Recharge exactly the 6000 RWF
       * shortfall.
       */
      const rechargeResponse =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${driver.token}`
          )
          .send({
            amount: 6000,
            phoneNumber: "0788666666",
          });

      expect(rechargeResponse.status).toBe(
        200
      );

      wallet =
        await prisma.wallet.findFirst();

      expect(wallet?.balance).toBe(10000);

      /*
       * Retry the same exit.
       */
      const secondExit =
        await request(app)
          .post("/api/parking/exit")
          .send({
            plateNumber:
              driver.plateNumber,
            tagId: driver.tagId,
            facilityId:
              driver.facilityId,
          });

      expect(secondExit.status).toBe(200);

      expect(
        secondExit.body.data.gateAction
      ).toBe("OPEN");

      /*
       * The fee must still be the original
       * locked 10,000 RWF.
       */
      expect(
        secondExit.body.data.fee.totalFee
      ).toBe(10000);

      /*
       * The full fee is now deducted.
       */
      wallet =
        await prisma.wallet.findFirst();

      expect(wallet?.balance).toBe(0);

      const completedSession =
        await prisma.parkingSession.findUnique({
          where: {
            sessionId,
          },
        });

      expect(
        completedSession?.status
      ).toBe("CLOSED");

      expect(
        completedSession?.fee
      ).toBe(lockedFee);

      /*
       * Most importantly, retrying exit must
       * NOT move the locked exit time forward.
       *
       * Otherwise the driver could be charged
       * more while standing at the gate trying
       * to recharge.
       */
      expect(
        completedSession?.exitTime?.getTime()
      ).toBe(
        lockedExitTime?.getTime()
      );

      /*
       * The existing PENDING parking payment
       * should have been completed rather than
       * creating a second parking-fee payment.
       */
      const completedPayment =
        await prisma.transaction.findUnique({
          where: {
            transactionId:
              pendingTransactionId!,
          },
        });

      expect(
        completedPayment?.status
      ).toBe("COMPLETED");

      expect(
        completedPayment?.amount
      ).toBe(10000);

      const parkingFeeTransactionCount =
        await prisma.transaction.count({
          where: {
            parkingSessionId: sessionId,
            type: "PARKING_FEE",
          },
        });

      expect(
        parkingFeeTransactionCount
      ).toBe(1);
    });
  });
});