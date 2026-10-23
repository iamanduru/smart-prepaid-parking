import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";

type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "VEHICLE_REGISTERED"
  | "VEHICLE_TAG_LINKED"
  | "WALLET_RECHARGED"
  | "PARKING_ENTRY"
  | "PARKING_EXIT"
  | "PARKING_PAYMENT_COMPLETED"
  | "PARKING_PAYMENT_PENDING"
  | "PARKING_RATE_UPDATED"
  | "ADMIN_REPORT_VIEWED";

type AuditResult =
  | "SUCCESS"
  | "FAILED";

interface CreateAuditLogInput {
  actorId?: string | null;

  action: AuditAction;
  result: AuditResult;

  resourceType?: string;
  resourceId?: string;

  details?: Prisma.InputJsonValue;

  ipAddress?: string;
}

export async function createAuditLog(
  input: CreateAuditLogInput
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,

        action: input.action,
        result: input.result,

        resourceType:
          input.resourceType ?? null,

        resourceId:
          input.resourceId ?? null,

        details:
          input.details ?? undefined,

        ipAddress:
          input.ipAddress ?? null,
      },
    });
  } catch (error) {
    
    console.error(
      "Failed to create audit log:",
      error
    );
  }
}