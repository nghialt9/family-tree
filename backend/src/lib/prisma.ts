import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '5');
  }
  return url.toString();
}

export const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
});
