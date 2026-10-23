import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "../generated/prisma/client";

import { env } from "./env";

function resolveDatabaseSchema(
  databaseUrl: string
) {
  const parsedUrl =
    new URL(databaseUrl);

  return (
    parsedUrl.searchParams.get("schema") ??
    "public"
  );
}

export const databaseSchema =
  resolveDatabaseSchema(
    env.DATABASE_URL
  );

const adapter =
  new PrismaPg(
    {
      connectionString:
        env.DATABASE_URL,
    },
    {
      schema: databaseSchema,
    }
  );

export const prisma =
  new PrismaClient({
    adapter,
  });