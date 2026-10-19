import { Router } from "express";

import {
  createVehicle,
  listVehicles,
  attachVehicleTag,
} from "../controllers/vehicle.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);
router.use(requireRole("VEHICLE_OWNER"));

router.post("/", createVehicle);
router.get("/", listVehicles);
router.post("/:vehicleId/tag", attachVehicleTag);

export default router;