import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { getRequestUser } from '../../lib/api-auth';

export const runtime = 'nodejs';

const VALID_STATUSES = ['liked', 'try', 'nope'] as const;
export type OutfitSuggestionStatus = (typeof VALID_STATUSES)[number];

const parseItemIds = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value: unknown): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const filterExistingItemIds = (itemIds: string[], validIds: Set<string>) =>
  itemIds.filter((id) => validIds.has(id));

const formatSuggestion =
  (validIds: Set<string>) =>
  (entry: {
    id: string;
    name: string;
    description: string | null;
    reasoning: string | null;
    itemIds: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description ?? '',
    reasoning: entry.reasoning ?? '',
    itemIds: filterExistingItemIds(parseItemIds(entry.itemIds), validIds),
    status: VALID_STATUSES.includes(entry.status as OutfitSuggestionStatus)
      ? (entry.status as OutfitSuggestionStatus)
      : 'try',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [rows, inventoryIds] = await Promise.all([
    prisma.outfitSuggestion.findMany({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.item.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const validIds = new Set<string>(
    inventoryIds.map((entry: (typeof inventoryIds)[number]) => entry.id)
  );
  const formatted = rows.map(formatSuggestion(validIds));
  return NextResponse.json({ suggestions: formatted });
}
