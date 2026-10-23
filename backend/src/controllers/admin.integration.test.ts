import bcrypt from "bcrypt";
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

describe("Administrator API integration tests", () => {
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

  async function createAdministrator() {
    const email =
      "integration.admin@parking.local";

    const password =
      "SecureAdminPass123";

    const passwordHash =
      await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name: "Integration Administrator",
        email,
        passwordHash,
        role: "ADMINISTRATOR",
      },
    });

    const loginResponse =
      await request(app)
        .post("/api/auth/login")
        .send({
          email,
          password,
        });

    expect(loginResponse.status).toBe(200);

    return loginResponse.body.data
      .token as string;
  }

  async function createVehicleOwner() {
    const email =
      "admin.test.owner@example.com";

    const password = "SecurePass123";

    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Admin Test Owner",
        email,
        phone: "0788777777",
        password,
      });

    const loginResponse =
      await request(app)
        .post("/api/auth/login")
        .send({
          email,
          password,
        });

    return loginResponse.body.data
      .token as string;
  }

  describe("Administrator authorization", () => {
    it("rejects access when no authentication token is provided", async () => {
      const response = await request(app)
        .get("/api/admin/transactions");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(
        false
      );
    });

    it("rejects a vehicle owner from administrator endpoints", async () => {
      const ownerToken =
        await createVehicleOwner();

      const response = await request(app)
        .get("/api/admin/transactions")
        .set(
          "Authorization",
          `Bearer ${ownerToken}`
        );

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(
        false
      );
    });
  });

  describe("GET /api/admin/transactions", () => {
    it("allows an administrator to view system transactions", async () => {
      const adminToken =
        await createAdministrator();

      const ownerToken =
        await createVehicleOwner();

      /*
       * Create a real recharge transaction
       * through the public wallet API.
       */
      const rechargeResponse =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${ownerToken}`
          )
          .send({
            amount: 5000,
            phoneNumber: "0788777777",
          });

      expect(
        rechargeResponse.status
      ).toBe(200);

      const response = await request(app)
        .get("/api/admin/transactions")
        .set(
          "Authorization",
          `Bearer ${adminToken}`
        );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(
        true
      );

      const transactions =
        response.body.data.transactions;

      expect(transactions).toHaveLength(1);

      expect(
        transactions[0].amount
      ).toBe(5000);

      expect(
        transactions[0].type
      ).toBe("RECHARGE");

      expect(
        transactions[0].status
      ).toBe("COMPLETED");
    });
  });

  describe("GET /api/admin/parking-rates", () => {
    it("allows an administrator to view configured parking rates", async () => {
      const adminToken =
        await createAdministrator();

      const response = await request(app)
        .get("/api/admin/parking-rates")
        .set(
          "Authorization",
          `Bearer ${adminToken}`
        );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(
        true
      );

      const rates =
        response.body.data.rates;

      expect(rates).toHaveLength(3);

      expect(
        rates.some(
          (rate: {
            price: number;
          }) => rate.price === 500
        )
      ).toBe(true);

      expect(
        response.body.data.currency
      ).toBe("RWF");
    });
  });

  describe(
    "PATCH /api/admin/parking-rates/:rateId",
    () => {
      it("allows an administrator to update a parking rate and creates an audit log", async () => {
        const adminToken =
          await createAdministrator();

        const rate =
          await prisma.parkingRate.findFirst({
            where: {
              minMinutes: 31,
              maxMinutes: 60,
            },
          });

        expect(rate).not.toBeNull();
        expect(rate?.price).toBe(500);

        const response = await request(app)
          .patch(
            `/api/admin/parking-rates/${rate!.rateId}`
          )
          .set(
            "Authorization",
            `Bearer ${adminToken}`
          )
          .send({
            price: 600,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(
          true
        );

        expect(
          response.body.data.rate.price
        ).toBe(600);

        /*
         * Confirm database persistence.
         */
        const updatedRate =
          await prisma.parkingRate.findUnique({
            where: {
              rateId: rate!.rateId,
            },
          });

        expect(
          updatedRate?.price
        ).toBe(600);

        /*
         * Confirm administrator action was
         * written to the audit trail.
         */
        const auditLog =
          await prisma.auditLog.findFirst({
            where: {
              action:
                "PARKING_RATE_UPDATED",
              resourceId: rate!.rateId,
            },
          });

        expect(auditLog).not.toBeNull();

        expect(
          auditLog?.result
        ).toBe("SUCCESS");

        expect(
          auditLog?.actorId
        ).not.toBeNull();
      });

      it("rejects a vehicle owner attempting to modify parking rates", async () => {
        const ownerToken =
          await createVehicleOwner();

        const rate =
          await prisma.parkingRate.findFirst({
            where: {
              minMinutes: 31,
              maxMinutes: 60,
            },
          });

        const response = await request(app)
          .patch(
            `/api/admin/parking-rates/${rate!.rateId}`
          )
          .set(
            "Authorization",
            `Bearer ${ownerToken}`
          )
          .send({
            price: 999999,
          });

        expect(response.status).toBe(403);

        /*
         * Unauthorized attempts must not
         * modify the rate.
         */
        const unchangedRate =
          await prisma.parkingRate.findUnique({
            where: {
              rateId: rate!.rateId,
            },
          });

        expect(
          unchangedRate?.price
        ).toBe(500);
      });
    }
  );

  describe(
    "GET /api/admin/reports/summary",
    () => {
      it("allows an administrator to generate the summary report and audits report access", async () => {
        const adminToken =
          await createAdministrator();

        /*
         * Add a vehicle owner so the report
         * contains real system data.
         */
        await createVehicleOwner();

        const response = await request(app)
          .get(
            "/api/admin/reports/summary"
          )
          .set(
            "Authorization",
            `Bearer ${adminToken}`
          );

        expect(response.status).toBe(200);

        expect(
          response.body.success
        ).toBe(true);

        expect(
          response.body.data.report
        ).toBeDefined();

        /*
         * Report access is a privileged action
         * and should therefore be auditable.
         */
        const auditLog =
          await prisma.auditLog.findFirst({
            where: {
              action:
                "ADMIN_REPORT_VIEWED",
            },
          });

        expect(auditLog).not.toBeNull();

        expect(
          auditLog?.result
        ).toBe("SUCCESS");

        expect(
          auditLog?.resourceType
        ).toBe("Report");

        expect(
          auditLog?.resourceId
        ).toBe("summary");
      });
    }
  );
});