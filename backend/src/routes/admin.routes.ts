import { Router } from "express";

import {
  editParkingRate,
  viewAllTransactions,
  viewParkingRates,
  generateSummaryReport,
} from "../controllers/admin.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMINISTRATOR"));

router.get(
  "/transactions",
  viewAllTransactions
);

router.get(
  "/parking-rates",
  viewParkingRates
);

router.patch(
  "/parking-rates/:rateId",
  editParkingRate
);

router.get(
  "/reports/summary",
  generateSummaryReport
);

export default router;