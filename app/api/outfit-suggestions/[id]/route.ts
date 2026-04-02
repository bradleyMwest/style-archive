import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

const VALID_STATUSES = ['liked', 'try', 'nope'] as const;
type OutfitSuggestionStatus = (typeof VALID_STATUSES)[number];

const isValidStatus = (value: unknown): value is OutfitSuggestionStatus =>
  typeof value === 'string' && VALID_STATUSES.includes(value as OutfitSuggestionStatus);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const nextStatus = body?.status;

    if (!isValidStatus(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.outfitSuggestion.update({
      where: { id },
      data: { status: nextStatus },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    console.error('Failed to update outfit suggestion', error);
    return NextResponse.json({ error: 'Unable to update suggestion' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await prisma.outfitSuggestion.delete({
      where: { id },
    });

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }
    console.error('Failed to delete outfit suggestion', error);
    return NextResponse.json({ error: 'Unable to delete suggestion' }, { status: 500 });
  }
}
