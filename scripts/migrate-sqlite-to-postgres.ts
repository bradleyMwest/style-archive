import './load-env';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { prisma } from '../app/lib/prisma';
import { hashPassword } from '../app/lib/passwords';

type SqliteItem = {
  id: string;
  name: string;
  type: string;
  color: string;
  size: string;
  image: string;
  images: string | null;
  heroImageHex: string | null;
  heroImageMimeType: string | null;
  description: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  tags: string;
  material: string | null;
  brand: string | null;
  listingUrl: string | null;
  dateAdded: string;
};

type SqliteOutfit = {
  id: string;
  name: string;
  itemIds: string;
  description: string | null;
  createdAt: string;
};

type SqliteSuggestion = {
  id: string;
  name: string;
  description: string | null;
  reasoning: string | null;
  itemIds: string;
  itemHash: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type SqliteUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const projectRoot = path.resolve(__dirname, '..');
const sqlitePath = path.join(projectRoot, 'dev.db');

function runSqliteQuery<T>(sql: string): T[] {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found at ${sqlitePath}`);
  }

  const compactSql = sql.replace(/\s+/g, ' ').trim();
  const result = spawnSync('sqlite3', ['-json', sqlitePath, compactSql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`sqlite3 exited with code ${result.status}: ${result.stderr}`);
  }

  const output = result.stdout.trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

async function migrateData() {
  const primaryEmail = 'bradwest2@gmail.com';
  const sqliteUsers = runSqliteQuery<SqliteUser>(`
    SELECT id, email, passwordHash, name, role, createdAt, updatedAt
    FROM User
    WHERE email = '${primaryEmail}';
  `);
  const primarySqliteUser = sqliteUsers[0];

  let primaryUser = await prisma.user.findUnique({
    where: { email: primaryEmail },
  });

  if (!primaryUser) {
    const passwordHashValue = primarySqliteUser?.passwordHash ?? hashPassword('password123');
    primaryUser = await prisma.user.create({
      data: {
        id: primarySqliteUser?.id,
        email: primaryEmail,
        passwordHash: passwordHashValue,
        name: primarySqliteUser?.name ?? null,
        role: primarySqliteUser?.role ?? 'user',
        createdAt: primarySqliteUser?.createdAt ? new Date(primarySqliteUser.createdAt) : undefined,
        updatedAt: primarySqliteUser?.updatedAt ? new Date(primarySqliteUser.updatedAt) : undefined,
      },
    });
    console.log(`Created primary user ${primaryEmail} in Postgres.`);
  }

  const primaryUserId = primaryUser.id;

  const sqliteItems = runSqliteQuery<SqliteItem>(`
    SELECT
      id,
      name,
      type,
      color,
      size,
      image,
      images,
      hex(heroImageData) AS heroImageHex,
      heroImageMimeType,
      description,
      priceAmount,
      priceCurrency,
      tags,
      material,
      brand,
      listingUrl,
      dateAdded
    FROM Item;
  `);

  console.log(`Found ${sqliteItems.length} item(s) in SQLite.`);

  for (const item of sqliteItems) {
    const heroImageBuffer = item.heroImageHex ? Buffer.from(item.heroImageHex, 'hex') : null;
    const baseData = {
      name: item.name,
      type: item.type,
      color: item.color,
      size: item.size,
      image: item.image,
      images: item.images ?? null,
      heroImageData: heroImageBuffer,
      heroImageMimeType: item.heroImageMimeType ?? null,
      description: item.description ?? null,
      priceAmount: item.priceAmount ?? null,
      priceCurrency: item.priceCurrency ?? null,
      tags: item.tags ?? '',
      material: item.material ?? null,
      brand: item.brand ?? null,
      listingUrl: item.listingUrl ?? null,
      dateAdded: item.dateAdded ? new Date(item.dateAdded) : new Date(),
      userId: primaryUserId,
    };

    await prisma.item.upsert({
      where: { id: item.id },
      update: baseData,
      create: {
        id: item.id,
        ...baseData,
      },
    });
  }

  const sqliteOutfits = runSqliteQuery<SqliteOutfit>(`
    SELECT id, name, itemIds, description, createdAt FROM Outfit;
  `);
  console.log(`Found ${sqliteOutfits.length} outfit(s) in SQLite.`);

  for (const outfit of sqliteOutfits) {
    const baseData = {
      name: outfit.name,
      itemIds: outfit.itemIds,
      description: outfit.description ?? null,
      createdAt: outfit.createdAt ? new Date(outfit.createdAt) : new Date(),
      userId: primaryUserId,
    };
    await prisma.outfit.upsert({
      where: { id: outfit.id },
      update: baseData,
      create: {
        id: outfit.id,
        ...baseData,
      },
    });
  }

  const sqliteSuggestions = runSqliteQuery<SqliteSuggestion>(`
    SELECT id, name, description, reasoning, itemIds, itemHash, status, createdAt, updatedAt
    FROM OutfitSuggestion;
  `);
  console.log(`Found ${sqliteSuggestions.length} outfit suggestion(s) in SQLite.`);

  for (const suggestion of sqliteSuggestions) {
    const baseData = {
      name: suggestion.name,
      description: suggestion.description ?? null,
      reasoning: suggestion.reasoning ?? null,
      itemIds: suggestion.itemIds,
      itemHash: suggestion.itemHash,
      status: suggestion.status,
      createdAt: suggestion.createdAt ? new Date(suggestion.createdAt) : new Date(),
      updatedAt: suggestion.updatedAt ? new Date(suggestion.updatedAt) : new Date(),
      userId: primaryUserId,
    };
    await prisma.outfitSuggestion.upsert({
      where: { id: suggestion.id },
      update: baseData,
      create: {
        id: suggestion.id,
        ...baseData,
      },
    });
  }
}

migrateData()
  .then(() => {
    console.log('Migration complete.');
  })
  .catch((error) => {
    console.error('Failed to migrate data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
