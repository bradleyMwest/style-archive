import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  var prisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const resolvedDatabaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;

if (!resolvedDatabaseUrl) {
  console.warn('DATABASE_URL is not set. Prisma will attempt to use the default config from schema.prisma.');
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

const adapter =
  resolvedDatabaseUrl &&
  new PrismaPg(
    new Pool({
      connectionString: resolvedDatabaseUrl,
    })
  );

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    adapter
      ? {
          adapter,
        }
      : undefined
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
