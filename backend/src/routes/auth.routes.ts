import { Router } from "express";

import {
  login,
  me,
  register,
} from "../controllers/auth.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  loginRateLimiter,
  registrationRateLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a vehicle owner account
 *     description: >
 *       Creates a new Vehicle Owner account and
 *       automatically creates the user's prepaid
 *       wallet. Public registration cannot create
 *       administrator accounts.
 *
 *     security: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *
 *     responses:
 *       201:
 *         description: Account registered successfully
 *
 *       400:
 *         description: Invalid registration data
 *
 *       409:
 *         description: Email address is already registered
 *
 *       429:
 *         description: >
 *           Too many registration attempts from
 *           the same client.
 */
router.post(
  "/register",
  registrationRateLimiter,
  register
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log in to the system
 *     description: >
 *       Authenticates a registered user using
 *       email and password and returns a JWT
 *       access token when authentication succeeds.
 *
 *       Failed authentication attempts are
 *       rate-limited to reduce brute-force and
 *       credential-guessing attacks.
 *
 *     security: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *
 *     responses:
 *       200:
 *         description: Login successful
 *
 *       400:
 *         description: Invalid login data
 *
 *       401:
 *         description: Invalid email or password
 *
 *       429:
 *         description: >
 *           Too many failed login attempts.
 *           Try again later.
 */
router.post(
  "/login",
  loginRateLimiter,
  login
);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get the authenticated user
 *     description: >
 *       Returns the profile of the currently
 *       authenticated user.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Authenticated user retrieved
 *
 *       401:
 *         description: >
 *           Missing, invalid, or expired
 *           authentication token.
 */
router.get(
  "/me",
  authenticate,
  me
);

export default router;