import { Router } from "express";

import {
  recharge,
  viewWallet,
} from "../controllers/wallet.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);
router.use(requireRole("VEHICLE_OWNER"));

router.get("/", viewWallet);
router.post("/recharge", recharge);

export default router;