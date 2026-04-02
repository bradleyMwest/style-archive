import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { buildCachedHeroImage, downloadHeroImage, toHeroImageBytes } from '../../../lib/hero-image';
import { getRequestUser } from '../../../lib/api-auth';

type HeroImageBytes = ReturnType<typeof toHeroImageBytes>;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existingItem = await prisma.item.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Delete the item
    await prisma.item.delete({ where: { id } });

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const item = await prisma.item.findFirst({ where: { id, userId: user.id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const payload = {
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
      material: item.material ?? null,
      brand: item.brand ?? null,
      listingUrl: item.listingUrl ?? null,
      description: item.description ?? null,
      priceAmount: item.priceAmount != null ? Number(item.priceAmount) : null,
      priceCurrency: item.priceCurrency ?? null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Failed to load item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
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

    // Check if item exists
    const existingItem = await prisma.item.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
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

    const normalizedListingUrl =
      typeof listingUrl === 'string' ? listingUrl.trim() : '';

    let heroImageData: HeroImageBytes | null = existingItem.heroImageData;
    let heroImageMimeType = existingItem.heroImageMimeType;
    if (image !== existingItem.image || !existingItem.heroImageData) {
      try {
        const downloaded = await downloadHeroImage(image);
        if (downloaded) {
          heroImageData = toHeroImageBytes(downloaded.data);
          heroImageMimeType = downloaded.mimeType;
        }
      } catch (error) {
        console.warn('Unable to refresh hero image cache', error);
      }
    }

    const resolvedHeroImageData: HeroImageBytes | null =
      heroImageData ?? existingItem.heroImageData ?? null;

    const updatedItem = await prisma.item.update({
      where: { id },
      data: {
        name,
        type,
        color,
        size,
        image,
        tags: normalizedTags.length ? normalizedTags.join(',') : existingItem.tags,
        images:
          normalizedImages.length > 0
            ? JSON.stringify(normalizedImages)
            : images === null
              ? null
              : existingItem.images,
        material: material || null,
        brand: brand || null,
        listingUrl: normalizedListingUrl || null,
        description: description ?? existingItem.description,
        priceAmount:
          typeof priceAmount === 'number' && !Number.isNaN(priceAmount)
            ? priceAmount
            : existingItem.priceAmount,
        priceCurrency:
          typeof priceCurrency === 'string' && priceCurrency.trim().length > 0
            ? priceCurrency
            : existingItem.priceCurrency,
        heroImageData: resolvedHeroImageData,
        heroImageMimeType: heroImageMimeType ?? existingItem.heroImageMimeType,
        userId: user.id,
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}
