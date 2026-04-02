import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { getRequestUser } from '../../lib/api-auth';

export const runtime = 'nodejs';

const parseItemIds = (itemIds: string | null) => {
  if (!itemIds) return [];
  try {
    const parsed = JSON.parse(itemIds);
    return Array.isArray(parsed)
      ? parsed.filter((value: unknown): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const filterExistingItemIds = (itemIds: string[], validIds: Set<string>) =>
  itemIds.filter((id) => validIds.has(id));

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [outfits, inventoryIds] = await Promise.all([
    prisma.outfit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.item.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const validIds = new Set<string>(
    inventoryIds.map((entry: (typeof inventoryIds)[number]) => entry.id)
  );

  const mappedOutfits = outfits.map((outfit: (typeof outfits)[number]) => {
    const filteredItemIds = filterExistingItemIds(parseItemIds(outfit.itemIds), validIds);
    return {
      id: outfit.id,
      name: outfit.name,
      description: outfit.description ?? '',
      itemIds: filteredItemIds,
      createdAt: outfit.createdAt,
    };
  });

  const formatted = mappedOutfits.filter(
    (outfit: (typeof mappedOutfits)[number]) => outfit.itemIds.length > 0
  );

  return NextResponse.json({ outfits: formatted });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const itemIds = Array.isArray(body?.itemIds)
      ? Array.from(
          new Set(body.itemIds.filter((value: unknown): value is string => typeof value === 'string'))
        )
      : [];

    if (!name || itemIds.length === 0) {
      return NextResponse.json({ error: 'Name and at least one item are required.' }, { status: 400 });
    }

    const created = await prisma.outfit.create({
      data: {
        name,
        description: description || null,
        itemIds: JSON.stringify(itemIds),
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        description: created.description ?? '',
        itemIds,
        createdAt: created.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create outfit', error);
    return NextResponse.json({ error: 'Failed to create outfit' }, { status: 500 });
  }
}
