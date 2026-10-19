import { Router } from "express";

import { parkingEntry } from "../controllers/parking.controller";

const router = Router();

router.post("/entry", parkingEntry);

export default router;