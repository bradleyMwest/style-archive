import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

declare global {
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

export const prisma = global.prisma || new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: databaseUrl
  })
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
