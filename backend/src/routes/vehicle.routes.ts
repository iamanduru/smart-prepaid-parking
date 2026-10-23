import { Router } from "express";

import {
  attachVehicleTag,
  createVehicle,
  listVehicles,
} from "../controllers/vehicle.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/*
 * All Vehicle routes require:
 * 1. A valid JWT
 * 2. VEHICLE_OWNER role
 */
router.use(authenticate);
router.use(requireRole("VEHICLE_OWNER"));

/**
 * @openapi
 * /api/vehicles:
 *   post:
 *     tags:
 *       - Vehicles
 *     summary: Register a vehicle
 *     description: Registers a new vehicle belonging to the authenticated Vehicle Owner.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plateNumber
 *               - make
 *               - model
 *             properties:
 *               plateNumber:
 *                 type: string
 *                 example: RAC123A
 *               make:
 *                 type: string
 *                 example: Toyota
 *               model:
 *                 type: string
 *                 example: RAV4
 *     responses:
 *       201:
 *         description: Vehicle registered successfully
 *       400:
 *         description: Invalid vehicle data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       409:
 *         description: Vehicle already registered
 */
router.post(
  "/",
  createVehicle
);

/**
 * @openapi
 * /api/vehicles:
 *   get:
 *     tags:
 *       - Vehicles
 *     summary: View registered vehicles
 *     description: Returns all vehicles belonging to the authenticated Vehicle Owner.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vehicles returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 */
router.get(
  "/",
  listVehicles
);

/**
 * @openapi
 * /api/vehicles/{vehicleId}/tag:
 *   post:
 *     tags:
 *       - Vehicles
 *     summary: Link a vehicle tag
 *     description: Links a unique RFID/NFC-style vehicle tag to a registered vehicle owned by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique ID of the registered vehicle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tagId
 *             properties:
 *               tagId:
 *                 type: string
 *                 example: TAG-RAC123A-001
 *     responses:
 *       201:
 *         description: Vehicle tag linked successfully
 *       400:
 *         description: Invalid vehicle tag data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Vehicle Owner role required
 *       404:
 *         description: Vehicle not found
 *       409:
 *         description: Vehicle already has a tag or tag is already in use
 */
router.post(
  "/:vehicleId/tag",
  attachVehicleTag
);

export default router;