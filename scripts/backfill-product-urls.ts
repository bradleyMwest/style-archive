import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
type RecordProductUrlFn = typeof import('../app/lib/product-url')['recordProductUrl'];

config();
config({ path: '.env.local', override: true });

let prismaClient: PrismaClient | null = null;
let recordUrlFn: RecordProductUrlFn | null = null;

const ensureDeps = async () => {
  if (prismaClient && recordUrlFn) return;
  const [prismaModule, productUrlModule] = await Promise.all([
    import('../app/lib/prisma'),
    import('../app/lib/product-url'),
  ]);
  prismaClient = prismaModule.prisma;
  recordUrlFn = productUrlModule.recordProductUrl;
};

const chunked = async <T>(items: T[], handler: (item: T) => Promise<void>, label: string) => {
  let processed = 0;
  for (const item of items) {
    await handler(item);
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`${label}: processed ${processed}/${items.length}`);
    }
  }
  console.log(`${label}: processed ${processed}/${items.length}`);
};

async function main() {
  await ensureDeps();
  const prisma = prismaClient!;
  const recordProductUrl = recordUrlFn!;

  const candidateSources = await prisma.candidateItem.findMany({
    select: { id: true, url: true, userId: true },
  });
  await chunked(
    candidateSources,
    (candidate) =>
      recordProductUrl({
        url: candidate.url,
        userId: candidate.userId,
        source: 'candidate',
        extra: { candidateId: candidate.id },
      }),
    'candidate urls'
  );

  const wardrobeItems = await prisma.item.findMany({
    select: { id: true, listingUrl: true, userId: true },
  });
  await chunked(
    wardrobeItems,
    (item) =>
      recordProductUrl({
        url: item.listingUrl,
        userId: item.userId ?? undefined,
        source: 'wardrobe-item',
        extra: { itemId: item.id },
      }),
    'wardrobe urls'
  );

  const retailProducts = await prisma.retailProduct.findMany({
    select: { id: true, listingUrl: true, retailer: true },
  });
  await chunked(
    retailProducts,
    (record) =>
      recordProductUrl({
        url: record.listingUrl,
        source: 'retail-product',
        extra: { retailProductId: record.id, retailer: record.retailer },
      }),
    'retail urls'
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed', error);
    process.exit(1);
  })
  .finally(async () => {
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });
