import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";

import authRouter from "./routes/auth.routes";
import vehicleRouter from "./routes/vehicle.routes";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Prepaid Parking API is running",
  });
});

// Routes here
app.use("/api/auth", authRouter);
app.use("/api/vehicles", vehicleRouter);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;