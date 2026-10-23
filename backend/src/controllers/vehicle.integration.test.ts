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

describe("Vehicle API integration tests", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  async function createAuthenticatedOwner() {
    const email = "vehicle.owner@example.com";
    const password = "SecurePass123";

    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Vehicle Test Owner",
        email,
        phone: "0788111111",
        password,
      });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password,
      });

    return loginResponse.body.data.token as string;
  }

  describe("POST /api/vehicles", () => {
    it("registers a vehicle for the authenticated owner", async () => {
      const token =
        await createAuthenticatedOwner();

      const response = await request(app)
        .post("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          plateNumber: "RAC 123 A",
          make: "Toyota",
          model: "RAV4",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const vehicle =
        await prisma.vehicle.findFirst({
          where: {
            plateNumber: "RAC123A",
          },
        });

      expect(vehicle).not.toBeNull();
      expect(vehicle?.make).toBe("Toyota");
      expect(vehicle?.model).toBe("RAV4");

      /*
       * Registration should also create
       * the appropriate audit event.
       */
      const auditLog =
        await prisma.auditLog.findFirst({
          where: {
            action: "VEHICLE_REGISTERED",
          },
        });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.result).toBe(
        "SUCCESS"
      );

      expect(auditLog?.resourceId).toBe(
        vehicle?.vehicleId
      );
    });

    it("rejects duplicate vehicle plates", async () => {
      const token =
        await createAuthenticatedOwner();

      const vehicleData = {
        plateNumber: "RAA100A",
        make: "Honda",
        model: "CR-V",
      };

      const firstResponse = await request(app)
        .post("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send(vehicleData);

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send(vehicleData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.success).toBe(
        false
      );
    });

    it("rejects vehicle registration without authentication", async () => {
      const response = await request(app)
        .post("/api/vehicles")
        .send({
          plateNumber: "RAB200B",
          make: "Nissan",
          model: "X-Trail",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/vehicles", () => {
    it("returns only vehicles belonging to the authenticated owner", async () => {
      const firstToken =
        await createAuthenticatedOwner();

      await request(app)
        .post("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${firstToken}`
        )
        .send({
          plateNumber: "RAC111A",
          make: "Toyota",
          model: "Corolla",
        });

      /*
       * Create a second independent owner.
       */
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Second Owner",
          email: "second.owner@example.com",
          phone: "0788222222",
          password: "SecurePass123",
        });

      const secondLogin = await request(app)
        .post("/api/auth/login")
        .send({
          email: "second.owner@example.com",
          password: "SecurePass123",
        });

      const secondToken =
        secondLogin.body.data.token;

      await request(app)
        .post("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${secondToken}`
        )
        .send({
          plateNumber: "RAD222B",
          make: "Mazda",
          model: "CX-5",
        });

      const response = await request(app)
        .get("/api/vehicles")
        .set(
          "Authorization",
          `Bearer ${firstToken}`
        );

      expect(response.status).toBe(200);

      const vehicles =
        response.body.data.vehicles;

      expect(vehicles).toHaveLength(1);

      expect(
        vehicles[0].plateNumber
      ).toBe("RAC111A");

      expect(
        vehicles.some(
          (vehicle: {
            plateNumber: string;
          }) =>
            vehicle.plateNumber ===
            "RAD222B"
        )
      ).toBe(false);
    });
  });

  describe(
    "POST /api/vehicles/:vehicleId/tag",
    () => {
      it("links a vehicle tag to the owner's vehicle", async () => {
        const token =
          await createAuthenticatedOwner();

        const vehicleResponse =
          await request(app)
            .post("/api/vehicles")
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              plateNumber: "RAC333C",
              make: "Toyota",
              model: "RAV4",
            });

        const vehicleId =
          vehicleResponse.body.data.vehicle
            .vehicleId;

        const response = await request(app)
          .post(
            `/api/vehicles/${vehicleId}/tag`
          )
          .set(
            "Authorization",
            `Bearer ${token}`
          )
          .send({
            tagId:
              "TAG-INTEGRATION-001",
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(
          true
        );

        const tag =
          await prisma.vehicleTag.findUnique({
            where: {
              tagId:
                "TAG-INTEGRATION-001",
            },
          });

        expect(tag).not.toBeNull();

        expect(tag?.vehicleId).toBe(
          vehicleId
        );

        const auditLog =
          await prisma.auditLog.findFirst({
            where: {
              action: "VEHICLE_TAG_LINKED",
            },
          });

        expect(auditLog).not.toBeNull();
        expect(auditLog?.result).toBe(
          "SUCCESS"
        );
      });

      it("does not allow an owner to link a tag to another owner's vehicle", async () => {
        const firstToken =
          await createAuthenticatedOwner();

        const vehicleResponse =
          await request(app)
            .post("/api/vehicles")
            .set(
              "Authorization",
              `Bearer ${firstToken}`
            )
            .send({
              plateNumber: "RAC444D",
              make: "Ford",
              model: "Ranger",
            });

        const vehicleId =
          vehicleResponse.body.data.vehicle
            .vehicleId;

        await request(app)
          .post("/api/auth/register")
          .send({
            name: "Unauthorized Owner",
            email:
              "unauthorized.owner@example.com",
            phone: "0788333333",
            password: "SecurePass123",
          });

        const loginResponse =
          await request(app)
            .post("/api/auth/login")
            .send({
              email:
                "unauthorized.owner@example.com",
              password: "SecurePass123",
            });

        const secondToken =
          loginResponse.body.data.token;

        const response = await request(app)
          .post(
            `/api/vehicles/${vehicleId}/tag`
          )
          .set(
            "Authorization",
            `Bearer ${secondToken}`
          )
          .send({
            tagId:
              "TAG-UNAUTHORIZED-001",
          });

        /*
         * The service deliberately behaves as if
         * the vehicle does not exist for this owner.
         *
         * This avoids exposing another user's
         * vehicle information.
         */
        expect(response.status).toBe(404);
      });

      it("rejects linking a second tag to a vehicle that already has one", async () => {
        const token =
          await createAuthenticatedOwner();

        const vehicleResponse =
          await request(app)
            .post("/api/vehicles")
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              plateNumber: "RAC555E",
              make: "Volkswagen",
              model: "Tiguan",
            });

        const vehicleId =
          vehicleResponse.body.data.vehicle
            .vehicleId;

        const firstResponse =
          await request(app)
            .post(
              `/api/vehicles/${vehicleId}/tag`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              tagId: "TAG-FIRST-001",
            });

        expect(firstResponse.status).toBe(
          201
        );

        const secondResponse =
          await request(app)
            .post(
              `/api/vehicles/${vehicleId}/tag`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              tagId: "TAG-SECOND-001",
            });

        expect(secondResponse.status).toBe(
          409
        );
      });
    }
  );
});