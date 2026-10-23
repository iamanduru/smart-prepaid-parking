import { Request, Response, NextFunction } from "express";

import { registerSchema } from "../validators/auth.validator";
import { registerUser } from "../services/auth.service";
import { loginSchema } from "../validators/auth.validator";
import { loginUser } from "../services/auth.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { getCurrentUser } from "../services/auth.service";
import { createAuditLog } from "../services/audit.service";


export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration data",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const user = await registerUser(validation.data);

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EMAIL_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid login data",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await loginUser(validation.data);

    await createAuditLog({
      actorId: result.user.id,
      action: "LOGIN_SUCCESS",
      result: "SUCCESS",
      resourceType: "User",
      resourceId: result.user.id,
      details: {
        email: result.user.email,
        role: result.user.role,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_CREDENTIALS"
    ) {
      await createAuditLog({
        actorId: null,
        action: "LOGIN_FAILED",
        result: "FAILED",
        resourceType: "User",
        details: {
          email:
            typeof req.body?.email === "string"
              ? req.body.email.toLowerCase()
              : "unknown",
          reason: "INVALID_CREDENTIALS",
        },
        ipAddress: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    next(error);
  }
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    next(error);
  }
}