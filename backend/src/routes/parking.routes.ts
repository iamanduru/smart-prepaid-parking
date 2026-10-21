import { Router } from "express";

import {
  parkingEntry,
  parkingExit,
  parkingHistory,
} from "../controllers/parking.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/*
 * Scanner / gate endpoints.
 * Device authentication will be added later.
 */
router.post("/entry", parkingEntry);
router.post("/exit", parkingExit);

/*
 * Vehicle Owner endpoint.
 */
router.get(
  "/history",
  authenticate,
  requireRole("VEHICLE_OWNER"),
  parkingHistory
);

export default router;