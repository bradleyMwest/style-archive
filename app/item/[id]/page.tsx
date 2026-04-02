import { notFound } from 'next/navigation';
import { prisma } from '../../lib/prisma';
import { buildCachedHeroImage } from '../../lib/hero-image';
import ItemDetailClient from './ItemDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getItem(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
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
    dateAdded: item.dateAdded,
    description: item.description ?? undefined,
    image: buildCachedHeroImage({
      data: item.heroImageData,
      mimeType: item.heroImageMimeType,
      fallbackUrl: item.image,
    }),
    images: item.images ? JSON.parse(item.images) : [],
    tags: item.tags ? item.tags.split(',').map((tag) => tag.trim()) : [],
    price:
      item.priceAmount != null
        ? { amount: Number(item.priceAmount), currency: item.priceCurrency ?? undefined }
        : undefined,
  };
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = await getItem(id);

  if (!item) {
    notFound();
  }

  return <ItemDetailClient item={item} />;
}
