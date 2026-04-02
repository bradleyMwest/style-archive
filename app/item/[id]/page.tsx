import { notFound } from 'next/navigation';
import { prisma } from '../../lib/prisma';
import { buildCachedHeroImage } from '../../lib/hero-image';
import ItemDetailClient from './ItemDetailClient';
import { requireUser } from '../../lib/auth';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getItem(id: string, userId: string) {
  const item = await prisma.item.findFirst({
    where: { id, userId },
  });

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    color: item.color,
    size: item.size,
    material: item.material ?? undefined,
    brand: item.brand ?? undefined,
    listingUrl: item.listingUrl ?? undefined,
    dateAdded: item.dateAdded.toISOString(),
    description: item.description ?? undefined,
    image: buildCachedHeroImage({
      data: item.heroImageData,
      mimeType: item.heroImageMimeType,
      fallbackUrl: item.image,
    }),
    images: item.images ? JSON.parse(item.images) : [],
    tags: item.tags
      ? item.tags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
      : [],
    price:
      item.priceAmount != null
        ? { amount: Number(item.priceAmount), currency: item.priceCurrency ?? undefined }
        : undefined,
  };
}

export default async function ItemPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const item = await getItem(id, user.id);

  if (!item) {
    notFound();
  }

  return <ItemDetailClient item={item} />;
}
