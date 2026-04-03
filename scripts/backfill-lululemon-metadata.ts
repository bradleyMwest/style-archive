import './load-env';
import type { Prisma } from '@prisma/client';
import { prisma } from '../app/lib/prisma';

type RetailRecord = {
  id: string;
  heroImage: string | null;
  gallery: string | null;
  tags: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
};

const parseGallery = (value: string | null) => {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed.filter((item) => typeof item === 'string') as string[]) : [];
  } catch {
    return [];
  }
};

const parseTags = (value: string | null) => {
  if (!value) return [] as string[];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

interface RetailMetadata extends Record<string, unknown> {
  gallery?: unknown;
  tags?: unknown;
  heroImage?: unknown;
  scrapedAt?: unknown;
}

async function main() {
  const products: RetailRecord[] = await prisma.retailProduct.findMany({
    where: { retailer: 'Lululemon' },
    select: {
      id: true,
      heroImage: true,
      gallery: true,
      tags: true,
      metadata: true,
      updatedAt: true,
    },
  });

  let updated = 0;

  for (const product of products) {
    const gallery = parseGallery(product.gallery);
    const tags = parseTags(product.tags);
    const existingMetadata = (product.metadata ?? {}) as RetailMetadata;
    const needsGallery = !Array.isArray(existingMetadata.gallery);
    const needsTags = !Array.isArray(existingMetadata.tags);

    if (!needsGallery && !needsTags) {
      continue;
    }

    await prisma.retailProduct.update({
      where: { id: product.id },
      data: {
        metadata: {
          ...existingMetadata,
          gallery,
          tags,
          heroImage: product.heroImage,
          scrapedAt:
            typeof existingMetadata.scrapedAt === 'string'
              ? existingMetadata.scrapedAt
              : product.updatedAt.toISOString(),
        },
      },
    });
    updated += 1;

    if (updated % 100 === 0) {
      console.log(`Backfilled ${updated} / ${products.length}`);
    }
  }

  console.log(`Updated metadata for ${updated} Lululemon products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
