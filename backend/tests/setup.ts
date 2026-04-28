import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export async function cleanDb() {
  await prisma.accessToken.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.person.deleteMany();
}

afterAll(async () => {
  await prisma.$disconnect();
});
