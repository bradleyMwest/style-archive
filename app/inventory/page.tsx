import InventoryClient from './InventoryClient';
import { prisma } from '../lib/prisma';
import { buildCachedHeroImage } from '../lib/hero-image';
import type { Item } from '../lib/types';

export const dynamic = 'force-dynamic';

function parseTags(rawTags: string): string[] {
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function parseImages(rawImages: string | null): string[] {
  if (!rawImages) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawImages);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse stored images JSON', error);
    return [];
  }
}

async function getInventoryItems(): Promise<Item[]> {
  const items = await prisma.item.findMany({
    orderBy: { dateAdded: 'desc' },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    color: item.color,
    size: item.size,
    image: buildCachedHeroImage({
      data: item.heroImageData,
      mimeType: item.heroImageMimeType,
      fallbackUrl: item.image,
    }),
    images: parseImages(item.images || null),
    tags: parseTags(item.tags || ''),
    material: item.material ?? undefined,
    brand: item.brand ?? undefined,
    description: item.description ?? undefined,
    listingUrl: item.listingUrl ?? undefined,
    dateAdded: item.dateAdded.toISOString(),
  }));
}

export default async function InventoryPage() {
  const items = await getInventoryItems();
  return <InventoryClient items={items} />;
}
