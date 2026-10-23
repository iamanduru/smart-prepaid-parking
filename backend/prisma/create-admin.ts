import bcrypt from "bcrypt";

import { prisma } from "../src/config/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be configured"
    );
  }

  if (ADMIN_PASSWORD.length < 8) {
    throw new Error(
      "Administrator password must contain at least 8 characters"
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: ADMIN_EMAIL.toLowerCase(),
    },
  });

  if (existingAdmin) {
    console.log("Administrator account already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(
    ADMIN_PASSWORD,
    12
  );

  const admin = await prisma.user.create({
    data: {
      name: "Parking Administrator",
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: "ADMINISTRATOR",
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("Administrator created successfully:");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });