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

describe("Authentication API integration tests", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("registers a vehicle owner and automatically creates a wallet", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Integration Test Driver",
          email: "integration.driver@example.com",
          phone: "0788000000",
          password: "SecurePass123",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const user = await prisma.user.findUnique({
        where: {
          email: "integration.driver@example.com",
        },
        include: {
          wallet: true,
        },
      });

      expect(user).not.toBeNull();
      expect(user?.role).toBe("VEHICLE_OWNER");

      /*
       * Registration should automatically create
       * the owner's prepaid wallet.
       */
      expect(user?.wallet).not.toBeNull();
      expect(user?.wallet?.balance).toBe(0);

      /*
       * Passwords must never be returned by the API.
       */
      expect(
        JSON.stringify(response.body)
      ).not.toContain("passwordHash");
    });

    it("rejects duplicate email registration", async () => {
      const registrationData = {
        name: "Integration Test Driver",
        email: "duplicate@example.com",
        phone: "0788000001",
        password: "SecurePass123",
      };

      const firstResponse = await request(app)
        .post("/api/auth/register")
        .send(registrationData);

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post("/api/auth/register")
        .send(registrationData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.success).toBe(false);
    });

    it("does not allow public registration as an administrator", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Fake Administrator",
          email: "fake.admin@example.com",
          phone: "0788000002",
          password: "SecurePass123",

          /*
           * A malicious client attempts to grant
           * itself administrator privileges.
           */
          role: "ADMINISTRATOR",
        });

      expect(response.status).toBe(201);

      const user = await prisma.user.findUnique({
        where: {
          email: "fake.admin@example.com",
        },
      });

      /*
       * Public registration must always produce
       * VEHICLE_OWNER regardless of extra client data.
       */
      expect(user?.role).toBe("VEHICLE_OWNER");
    });
  });

  describe("POST /api/auth/login", () => {
    async function registerTestUser() {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Login Test Driver",
          email: "login.driver@example.com",
          phone: "0788000003",
          password: "SecurePass123",
        });
    }

    it("logs in with valid credentials and returns a JWT", async () => {
      await registerTestUser();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login.driver@example.com",
          password: "SecurePass123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(
        typeof response.body.data.token
      ).toBe("string");

      expect(
        response.body.data.token.length
      ).toBeGreaterThan(20);

      /*
       * Successful login must create an audit event.
       */
      const auditLog =
        await prisma.auditLog.findFirst({
          where: {
            action: "LOGIN_SUCCESS",
          },
        });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.result).toBe("SUCCESS");
    });

    it("rejects an incorrect password without revealing whether the account exists", async () => {
      await registerTestUser();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login.driver@example.com",
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      expect(response.body.message).toBe(
        "Invalid email or password"
      );

      const auditLog =
        await prisma.auditLog.findFirst({
          where: {
            action: "LOGIN_FAILED",
          },
        });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.result).toBe("FAILED");

      /*
       * Failed authentication should not claim
       * an authenticated actor.
       */
      expect(auditLog?.actorId).toBeNull();
    });

    it("uses the same error message for a nonexistent account", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "does.not.exist@example.com",
          password: "SecurePass123",
        });

      expect(response.status).toBe(401);

      expect(response.body.message).toBe(
        "Invalid email or password"
      );
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns the authenticated user's profile", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Profile Test Driver",
          email: "profile.driver@example.com",
          phone: "0788000004",
          password: "SecurePass123",
        });

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "profile.driver@example.com",
          password: "SecurePass123",
        });

      const token =
        loginResponse.body.data.token;

      const response = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${token}`
        );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data.user.email
      ).toBe("profile.driver@example.com");

      expect(
        response.body.data.user.role
      ).toBe("VEHICLE_OWNER");

      expect(
        JSON.stringify(response.body)
      ).not.toContain("passwordHash");
    });

    it("rejects access without a token", async () => {
      const response = await request(app)
        .get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("rejects an invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          "Bearer definitely-not-a-valid-token"
        );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});