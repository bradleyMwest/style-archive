import { prisma } from '../app/lib/prisma';
import { importProductFromUrl } from '../app/lib/importer/import-product';

async function backfillPrices() {
  const items = await prisma.item.findMany({
    where: {
      priceAmount: null,
      listingUrl: { not: null },
    },
  });

  console.log(`Found ${items.length} item(s) missing price.`);

  for (const item of items) {
    if (!item.listingUrl) {
      console.warn(`Skipping ${item.id} - missing listingUrl.`);
      continue;
    }

    try {
      const draft = await importProductFromUrl(item.listingUrl);
      const price = draft.price;
      if (!price?.amount || Number.isNaN(price.amount)) {
        console.warn(`No price found for ${item.id}`);
        continue;
      }

      await prisma.item.update({
        where: { id: item.id },
        data: {
          priceAmount: price.amount,
          priceCurrency: price.currency || item.priceCurrency || 'USD',
          description: item.description || draft.description || null,
        },
      });

      console.log(`Updated price for ${item.id}`);
    } catch (error) {
      console.error(`Failed to backfill price for ${item.id}:`, error);
    }
  }
}

backfillPrices()
  .catch((error) => {
    console.error('Backfill run failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
