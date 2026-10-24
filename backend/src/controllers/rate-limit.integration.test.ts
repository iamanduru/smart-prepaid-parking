import jwt from "jsonwebtoken";
import request from "supertest";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import app from "../app";
import { prisma } from "../config/prisma";

import {
  hashScannerApiKey,
} from "../utils/scanner-key";

import {
  resetTestDatabase,
} from "../test/reset-test-database";

describe(
  "API rate limiting integration tests",
  () => {
    beforeEach(async () => {
      /*
       * Enable the endpoint-specific limiters
       * only for this dedicated security suite.
       *
       * Normal integration tests skip them.
       */
      process.env.RATE_LIMIT_TEST_MODE =
        "enabled";

      await resetTestDatabase();
    });

    afterEach(() => {
      /*
       * Prevent test-only rate-limit settings
       * from leaking into other suites.
       */
      delete process.env
        .RATE_LIMIT_TEST_MODE;

      delete process.env
        .GLOBAL_RATE_LIMIT_TEST_MODE;
    });

    afterAll(async () => {
      await resetTestDatabase();

      await prisma.$disconnect();
    });

    it(
      "blocks the 11th failed login attempt from the same client",
      async () => {
        const registrationResponse =
          await request(app)
            .post("/api/auth/register")
            .send({
              name:
                "Rate Limit Test User",

              email:
                "rate.limit@example.com",

              phone:
                "0788000010",

              password:
                "SecurePass123",
            });

        expect(
          registrationResponse.status
        ).toBe(201);

        /*
         * Failed attempts 1–10 should reach
         * the login controller normally.
         */
        for (
          let attempt = 1;
          attempt <= 10;
          attempt++
        ) {
          const response =
            await request(app)
              .post(
                "/api/auth/login"
              )
              .send({
                email:
                  "rate.limit@example.com",

                password:
                  "DefinitelyWrongPassword",
              });

          expect(
            response.status
          ).toBe(401);

          expect(
            response.body.message
          ).toBe(
            "Invalid email or password"
          );
        }

        /*
         * Attempt 11 should be intercepted
         * by loginRateLimiter.
         */
        const blockedResponse =
          await request(app)
            .post("/api/auth/login")
            .send({
              email:
                "rate.limit@example.com",

              password:
                "DefinitelyWrongPassword",
            });

        expect(
          blockedResponse.status
        ).toBe(429);

        expect(
          blockedResponse.body.success
        ).toBe(false);

        expect(
          blockedResponse.body.message
        ).toBe(
          "Too many login attempts. Please try again later."
        );
      }
    );

    it(
      "blocks the 11th wallet recharge attempt for the same authenticated user",
      async () => {
        const registrationResponse =
          await request(app)
            .post("/api/auth/register")
            .send({
              name:
                "Recharge Rate Limit User",

              email:
                "recharge.limit@example.com",

              phone:
                "0788000020",

              password:
                "SecurePass123",
            });

        expect(
          registrationResponse.status
        ).toBe(201);

        const user =
          await prisma.user.findUnique({
            where: {
              email:
                "recharge.limit@example.com",
            },
          });

        expect(user).not.toBeNull();

        const jwtSecret =
          process.env.JWT_SECRET;

        if (!jwtSecret) {
          throw new Error(
            "JWT_SECRET is required for integration tests."
          );
        }

        /*
         * Generate a valid Vehicle Owner token
         * directly so this test remains independent
         * of the login limiter.
         */
        const token =
          jwt.sign(
            {
              role:
                "VEHICLE_OWNER",
            },
            jwtSecret,
            {
              subject: user!.id,
              expiresIn: "1h",
            }
          );

        /*
         * Use an invalid amount so no real wallet
         * credit is performed during the abuse test.
         *
         * Requests 1–10 reach validation and
         * therefore return 400.
         */
        for (
          let attempt = 1;
          attempt <= 10;
          attempt++
        ) {
          const response =
            await request(app)
              .post(
                "/api/wallet/recharge"
              )
              .set(
                "Authorization",
                `Bearer ${token}`
              )
              .send({
                amount: 100,

                phoneNumber:
                  "0788000020",
              });

          expect(
            response.status
          ).toBe(400);
        }

        /*
         * Request 11 should be intercepted by
         * walletRechargeRateLimiter.
         */
        const blockedResponse =
          await request(app)
            .post(
              "/api/wallet/recharge"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              amount: 100,

              phoneNumber:
                "0788000020",
            });

        expect(
          blockedResponse.status
        ).toBe(429);

        expect(
          blockedResponse.body.success
        ).toBe(false);

        expect(
          blockedResponse.body.message
        ).toBe(
          "Too many wallet recharge attempts. Please try again later."
        );

        const transactions =
          await prisma.transaction.count();

        expect(
          transactions
        ).toBe(0);

        const wallet =
          await prisma.wallet.findFirst({
            where: {
              userId:
                user!.id,
            },
          });

        expect(
          wallet?.balance
        ).toBe(0);
      }
    );

    it(
      "blocks a scanner after exceeding its authenticated device request limit",
      async () => {
        await prisma.parkingFacility.create({
          data: {
            facilityId:
              "rate-limit-facility",

            name:
              "Rate Limit Test Facility",

            location:
              "Kigali",
          },
        });

        const scannerApiKey =
          "spk_rate_limit_test_scanner_key";

        await prisma.scannerDevice.create({
          data: {
            deviceCode:
              "RATE-LIMIT-SCANNER-001",

            name:
              "Rate Limit Scanner",

            apiKeyHash:
              hashScannerApiKey(
                scannerApiKey
              ),

            facilityId:
              "rate-limit-facility",
          },
        });

        const parkingBody = {
          /*
           * Deliberately nonexistent vehicle.
           *
           * The scanner request passes the
           * authentication/rate-limit layers but
           * does not create a parking session.
           */
          plateNumber:
            "RATE999Z",

          tagId:
            "TAG-RATE-LIMIT",

          facilityId:
            "rate-limit-facility",
        };

        /*
         * Device requests 1–120 are allowed.
         *
         * Parking logic returns 404 because the
         * test vehicle does not exist.
         */
        for (
          let attempt = 1;
          attempt <= 120;
          attempt++
        ) {
          const response =
            await request(app)
              .post(
                "/api/parking/entry"
              )
              .set(
                "X-Scanner-Key",
                scannerApiKey
              )
              .send(
                parkingBody
              );

          expect(
            response.status
          ).toBe(404);
        }

        /*
         * Device request 121 should be blocked.
         */
        const blockedResponse =
          await request(app)
            .post(
              "/api/parking/entry"
            )
            .set(
              "X-Scanner-Key",
              scannerApiKey
            )
            .send(
              parkingBody
            );

        expect(
          blockedResponse.status
        ).toBe(429);

        expect(
          blockedResponse.body.success
        ).toBe(false);

        expect(
          blockedResponse.body.gateAction
        ).toBe("DENY");

        expect(
          blockedResponse.body.message
        ).toBe(
          "Scanner request limit exceeded. Please try again shortly."
        );

        const sessions =
          await prisma.parkingSession.count();

        expect(
          sessions
        ).toBe(0);
      }
    );

    it(
      "blocks requests after the global API limit is exceeded",
      async () => {
        /*
         * Enable the test-specific lower global
         * threshold.
         *
         * Production remains 500 requests
         * per 15 minutes.
         *
         * Test mode uses 25 so this test remains
         * fast and lightweight.
         */
        process.env
          .GLOBAL_RATE_LIMIT_TEST_MODE =
          "enabled";

        /*
         * Use a nonexistent API route.
         *
         * This ensures no database or business
         * operation occurs.
         *
         * Requests 1–25 should pass the general
         * limiter and reach the normal 404 handler.
         */
        for (
          let attempt = 1;
          attempt <= 25;
          attempt++
        ) {
          const response =
            await request(app)
              .get(
                "/api/global-rate-limit-probe"
              );

          expect(
            response.status
          ).toBe(404);
        }

        /*
         * Request 26 should be stopped by
         * generalApiLimiter before reaching
         * the application's 404 handler.
         */
        const blockedResponse =
          await request(app)
            .get(
              "/api/global-rate-limit-probe"
            );

        expect(
          blockedResponse.status
        ).toBe(429);

        expect(
          blockedResponse.body.success
        ).toBe(false);

        expect(
          blockedResponse.body.message
        ).toBe(
          "Too many requests. Please try again later."
        );
      }
    );
  }
);