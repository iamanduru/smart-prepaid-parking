import { Router } from "express";

import {
  parkingEntry,
  parkingExit,
} from "../controllers/parking.controller";

const router = Router();

router.post("/entry", parkingEntry);
router.post("/exit", parkingExit);

export default router;