import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding parking rates...");

  const facility = await prisma.parkingFacility.upsert({
    where: {
      facilityId: "default-facility",
    },
    update: {},
    create: {
      facilityId: "default-facility",
      name: "Main Parking Facility",
      location: "Kigali",
    },
  });

  const rates = [
    { label: "Free Parking", minMinutes: 0, maxMinutes: 30, price: 0 },
    { label: "Up to 1 Hour", minMinutes: 31, maxMinutes: 60, price: 500 },
    { label: "Up to 2 Hours", minMinutes: 61, maxMinutes: 120, price: 1000 },
    { label: "Up to 3 Hours", minMinutes: 121, maxMinutes: 180, price: 1500 },
    { label: "Up to 4 Hours", minMinutes: 181, maxMinutes: 240, price: 2000 },
    { label: "Up to 5 Hours", minMinutes: 241, maxMinutes: 300, price: 2500 },
    { label: "Up to 6 Hours", minMinutes: 301, maxMinutes: 360, price: 3000 },
    { label: "Up to 7 Hours", minMinutes: 361, maxMinutes: 420, price: 3500 },
    { label: "Up to 8 Hours", minMinutes: 421, maxMinutes: 480, price: 4000 },
    { label: "Overnight", minMinutes: 481, maxMinutes: 1440, price: 10000 },
  ];

  for (const rate of rates) {
    await prisma.parkingRate.upsert({
      where: {
        facilityId_minMinutes_maxMinutes: {
          facilityId: facility.facilityId,
          minMinutes: rate.minMinutes,
          maxMinutes: rate.maxMinutes,
        },
      },
      update: {
        label: rate.label,
        price: rate.price,
        isActive: true,
      },
      create: {
        ...rate,
        facilityId: facility.facilityId,
      },
    });
  }

  console.log("Parking rates seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });