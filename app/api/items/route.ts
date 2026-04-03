import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { buildCachedHeroImage, downloadHeroImage, toHeroImageBytes } from '../../lib/hero-image';
import { getRequestUser } from '../../lib/api-auth';
import { recordProductUrl } from '../../lib/product-url';

type HeroImageBytes = ReturnType<typeof toHeroImageBytes>;

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await prisma.item.findMany({
    where: { userId: user.id },
    orderBy: { dateAdded: 'desc' },
  });

  const formattedItems = items.map((item: (typeof items)[number]) => ({
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
    tags: item.tags
      ? item.tags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
      : [],
    images: item.images ? JSON.parse(item.images) : [],
    material: item.material,
    brand: item.brand,
    description: item.description,
    price:
      item.priceAmount != null
        ? {
            amount: Number(item.priceAmount),
            currency: item.priceCurrency || undefined,
          }
        : undefined,
    listingUrl: item.listingUrl,
    dateAdded: item.dateAdded,
  }));

  return NextResponse.json(formattedItems);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      type,
      color,
      size,
      image,
      tags,
      images,
      material,
      brand,
      listingUrl,
      description,
      priceAmount,
      priceCurrency,
    } = body;

    if (!name || !type || !color || !size || !image) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
        : [];

    const normalizedImages = Array.isArray(images)
      ? images
          .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
          .filter((url: string) => url.length > 0)
      : [];

    let heroImageData: HeroImageBytes | null = null;
    let heroImageMimeType: string | undefined;
    try {
      const downloaded = await downloadHeroImage(image);
      if (downloaded) {
        heroImageData = toHeroImageBytes(downloaded.data);
        heroImageMimeType = downloaded.mimeType;
      }
    } catch (downloadError) {
      console.warn('Unable to cache hero image', image, downloadError);
    }

    const item = await prisma.item.create({
      data: {
        name,
        type,
        color,
        size,
        image,
        tags: normalizedTags.join(','),
        images: normalizedImages.length > 0 ? JSON.stringify(normalizedImages) : null,
        material: material || null,
        brand: brand || null,
        listingUrl: listingUrl || null,
        description: description || null,
        priceAmount: typeof priceAmount === 'number' && !Number.isNaN(priceAmount) ? priceAmount : null,
        priceCurrency: priceCurrency || null,
        heroImageData,
        heroImageMimeType: heroImageMimeType ?? null,
        userId: user.id,
      },
    });

    if (listingUrl && typeof listingUrl === 'string' && listingUrl.trim().length > 0) {
      await recordProductUrl({
        url: listingUrl,
        userId: user.id,
        source: 'wardrobe-item',
        extra: { itemId: item.id },
      });
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
