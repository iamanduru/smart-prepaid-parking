import {
  ipKeyGenerator,
  rateLimit,
} from "express-rate-limit";

import type {
  AuthenticatedRequest,
} from "./auth.middleware";

import type {
  ScannerAuthenticatedRequest,
} from "./scanner-auth.middleware";

function skipDuringNormalTests() {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.RATE_LIMIT_TEST_MODE !==
      "enabled"
  );
}

function getRequestIp(
  req: {
    ip?: string;
    socket: {
      remoteAddress?: string;
    };
  }
) {
  return (
    req.ip ??
    req.socket.remoteAddress ??
    "127.0.0.1"
  );
}


export const generalApiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    /*
     * Production/default:
     * 500 requests per 15 minutes.
     *
     * Dedicated global-limit integration test:
     * 25 requests so we do not need to generate
     * hundreds of requests just to prove 429.
     */
    limit: () => {
      if (
        process.env.NODE_ENV === "test" &&
        process.env.GLOBAL_RATE_LIMIT_TEST_MODE ===
          "enabled"
      ) {
        return 25;
      }

      return 500;
    },

    standardHeaders: "draft-8",

    legacyHeaders: false,

    /*
     * Normal integration tests should not use
     * the global limiter.
     *
     * The dedicated global-limit test enables
     * it explicitly with:
     *
     * GLOBAL_RATE_LIMIT_TEST_MODE=enabled
     */
    skip: () => {
      return (
        process.env.NODE_ENV === "test" &&
        process.env
          .GLOBAL_RATE_LIMIT_TEST_MODE !==
          "enabled"
      );
    },

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Too many requests. Please try again later.",
      });
    },
  });


export const loginRateLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    skipSuccessfulRequests: true,

    skip: skipDuringNormalTests,

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Too many login attempts. Please try again later.",
      });
    },
  });


export const registrationRateLimiter =
  rateLimit({
    windowMs: 60 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    skip: skipDuringNormalTests,

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Too many registration attempts. Please try again later.",
      });
    },
  });


export const scannerIpRateLimiter =
  rateLimit({
    windowMs: 60 * 1000,

    limit: 300,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    skip: skipDuringNormalTests,

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Too many scanner requests. Please try again shortly.",

        gateAction: "DENY",
      });
    },
  });


export const scannerDeviceRateLimiter =
  rateLimit({
    windowMs: 60 * 1000,

    limit: 120,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    skip: skipDuringNormalTests,

    keyGenerator: (req) => {
      const scannerRequest =
        req as ScannerAuthenticatedRequest;

      
      if (
        scannerRequest.scannerDevice
          ?.deviceId
      ) {
        return `scanner:${scannerRequest.scannerDevice.deviceId}`;
      }

      
      return `ip:${ipKeyGenerator(
        getRequestIp(req)
      )}`;
    },

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Scanner request limit exceeded. Please try again shortly.",

        gateAction: "DENY",
      });
    },
  });


export const walletRechargeRateLimiter =
  rateLimit({
    windowMs: 10 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    skip: skipDuringNormalTests,

    keyGenerator: (req) => {
      const authenticatedRequest =
        req as AuthenticatedRequest;

      if (
        authenticatedRequest.user?.id
      ) {
        return `user:${authenticatedRequest.user.id}`;
      }

      return `ip:${ipKeyGenerator(
        getRequestIp(req)
      )}`;
    },

    handler: (_req, res) => {
      return res.status(429).json({
        success: false,

        message:
          "Too many wallet recharge attempts. Please try again later.",
      });
    },
  });