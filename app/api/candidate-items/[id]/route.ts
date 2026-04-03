import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getRequestUser } from '../../../lib/api-auth';
import { mapCandidateRecord } from '../../../lib/candidate-mapper';

export const runtime = 'nodejs';

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? (value.trim().length > 0 ? value.trim() : null) : null;

const normalizeTags = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((tag) => tag.length > 0)
      .join(',');
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .join(',');
  }
  return null;
};

const normalizePriceAmount = (value: unknown) => {
  if (typeof value !== 'number') return null;
  if (Number.isNaN(value)) return null;
  return new Prisma.Decimal(value);
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidate = await prisma.candidateItem.findFirst({
    where: { id: params.id, userId: user.id },
    include: { evaluation: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: Prisma.CandidateItemUpdateInput = {};

    if ('title' in body) data.title = normalizeString(body.title);
    if ('brand' in body) data.brand = normalizeString(body.brand);
    if ('type' in body) data.type = normalizeString(body.type);
    if ('color' in body) data.color = normalizeString(body.color);
    if ('size' in body) data.size = normalizeString(body.size);
    if ('material' in body) data.material = normalizeString(body.material);
    if ('description' in body) data.description = normalizeString(body.description);
    if ('notes' in body) data.notes = normalizeString(body.notes);
    if ('tags' in body) data.tags = normalizeTags(body.tags);
    if ('status' in body && typeof body.status === 'string') {
      const statusValue = body.status.trim().toLowerCase();
      const allowedStatuses = ['draft', 'ready', 'evaluated', 'archived'];
      if (allowedStatuses.includes(statusValue)) {
        data.status = statusValue as Prisma.CandidateItemUpdateInput['status'];
      }
    }
    if ('price' in body && body.price) {
      const amount = normalizePriceAmount(body.price.amount);
      data.priceAmount = amount;
      if ('currency' in body.price && typeof body.price.currency === 'string') {
        data.priceCurrency = body.price.currency.trim().toUpperCase();
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ candidate: mapCandidateRecord(candidate) });
    }

    const updated = await prisma.candidateItem.update({
      where: { id: candidate.id },
      data,
      include: { evaluation: true },
    });

    return NextResponse.json({ candidate: mapCandidateRecord(updated) });
  } catch (error) {
    console.error('Failed to update candidate', error);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
}
