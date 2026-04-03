import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getRequestUser } from '../../lib/api-auth';
import { importProductFromUrl } from '../../lib/importer/import-product';
import { mapCandidateRecord } from '../../lib/candidate-mapper';
import { recordProductUrl } from '../../lib/product-url';

export const runtime = 'nodejs';

const serializeCandidates = (records: Awaited<ReturnType<typeof prisma.candidateItem.findMany>>) =>
  records.map(mapCandidateRecord);

const normalizeTags = (tags?: string[]) =>
  tags && tags.length > 0 ? tags.map((tag) => tag.trim()).filter(Boolean).join(',') : null;

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await prisma.candidateItem.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: 'desc' }],
    include: { evaluation: true },
  });

  return NextResponse.json({ candidates: serializeCandidates(candidates) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, preferPlaywright } = body ?? {};
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const draft = await importProductFromUrl(url, {
      preferPlaywright: Boolean(preferPlaywright),
    });

    const normalizedUrl = new URL(draft.url || url);
    const tags = draft.tags ?? [];

    const candidate = await prisma.candidateItem.create({
      data: {
        userId: user.id,
        url: normalizedUrl.href,
        sourceDomain: normalizedUrl.hostname,
        title: draft.title ?? null,
        brand: draft.brand ?? null,
        type: draft.type ?? null,
        color: draft.color ?? null,
        size: draft.size ?? null,
        material: draft.material ?? null,
        description: draft.description ?? null,
        tags: normalizeTags(tags),
        heroImage: draft.images?.[0] ?? null,
        images: draft.images && draft.images.length > 0 ? JSON.stringify(draft.images) : null,
        priceAmount:
          typeof draft.price?.amount === 'number' && !Number.isNaN(draft.price.amount)
            ? new Prisma.Decimal(draft.price.amount)
            : null,
        priceCurrency: draft.price?.currency ?? null,
        status: 'ready',
        rawImport: draft as unknown as Prisma.InputJsonValue,
      },
      include: { evaluation: true },
    });

    await recordProductUrl({
      url: candidate.url,
      userId: user.id,
      source: 'candidate',
      extra: { candidateId: candidate.id },
    });

    return NextResponse.json({ candidate: mapCandidateRecord(candidate) }, { status: 201 });
  } catch (error) {
    console.error('Candidate import failed', error);
    return NextResponse.json({ error: 'Failed to import product URL' }, { status: 500 });
  }
}
