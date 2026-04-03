import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import type { CandidateItem as CandidateModel } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { getRequestUser } from '../../../../lib/api-auth';
import { mapCandidateRecord } from '../../../../lib/candidate-mapper';
import { evaluateCandidate } from '../../../../lib/candidate-evaluator';

export const runtime = 'nodejs';

type WardrobeHashEntry = {
  id: string;
  type: string | null;
  color: string | null;
  tags: string | null;
  brand: string | null;
  material: string | null;
  name: string | null;
  listingUrl: string | null;
  image: string | null;
};

const serializeWardrobeForHash = (
  wardrobe: Awaited<ReturnType<typeof prisma.item.findMany>>
): WardrobeHashEntry[] =>
  wardrobe
    .map((item) => ({
      id: item.id,
      type: item.type ?? null,
      color: item.color ?? null,
      tags: item.tags ?? null,
      brand: item.brand ?? null,
      material: item.material ?? null,
      name: item.name ?? null,
      listingUrl: item.listingUrl ?? null,
      image: item.image ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

type CandidateForHash = Pick<
  CandidateModel,
  'id' | 'title' | 'type' | 'color' | 'tags' | 'brand' | 'material' | 'description' | 'heroImage' | 'images' | 'updatedAt'
>;

const buildEvaluationHash = (
  candidate: CandidateForHash,
  wardrobeData: WardrobeHashEntry[]
) => {
  const payload = {
    candidate: {
      id: candidate.id,
      title: candidate.title ?? null,
      type: candidate.type ?? null,
      color: candidate.color ?? null,
      tags: candidate.tags ?? null,
      brand: candidate.brand ?? null,
      material: candidate.material ?? null,
      description: candidate.description ?? null,
      heroImage: candidate.heroImage ?? null,
      images: candidate.images ?? null,
      updatedAt: candidate.updatedAt.toISOString(),
    },
    wardrobe: wardrobeData,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const candidate = await prisma.candidateItem.findFirst({
    where: { id, userId: user.id },
    include: { evaluation: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const wardrobeItems = await prisma.item.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      type: true,
      color: true,
      tags: true,
      brand: true,
      material: true,
      name: true,
      listingUrl: true,
      heroImageData: true,
      heroImageMimeType: true,
      image: true,
    },
  });

  if (wardrobeItems.length === 0) {
    return NextResponse.json(
      { error: 'Add wardrobe items before running an evaluation.' },
      { status: 400 }
    );
  }

  const wardrobeForHash = serializeWardrobeForHash(wardrobeItems);
  const evaluationHash = buildEvaluationHash(candidate, wardrobeForHash);

  if (candidate.evaluation?.inputHash === evaluationHash) {
    return NextResponse.json({ candidate: mapCandidateRecord(candidate) });
  }

  const result = await evaluateCandidate(candidate, wardrobeItems);

  await prisma.$transaction([
    prisma.candidateEvaluation.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        verdict: result.verdict,
        explanation: result.explanation,
        compatibilityScore: result.compatibilityScore,
        redundancyScore: result.redundancyScore,
        gapScore: result.gapScore,
        versatilityScore: result.versatilityScore,
        reasoning: result.reasoning,
        inputHash: evaluationHash,
      },
      update: {
        verdict: result.verdict,
        explanation: result.explanation,
        compatibilityScore: result.compatibilityScore,
        redundancyScore: result.redundancyScore,
        gapScore: result.gapScore,
        versatilityScore: result.versatilityScore,
        reasoning: result.reasoning,
        inputHash: evaluationHash,
        updatedAt: new Date(),
      },
    }),
    prisma.candidateItem.update({
      where: { id: candidate.id },
      data: {
        status: 'evaluated',
        updatedAt: new Date(),
      },
    }),
  ]);

  const refreshed = await prisma.candidateItem.findUnique({
    where: { id: candidate.id },
    include: { evaluation: true },
  });

  return NextResponse.json({ candidate: refreshed ? mapCandidateRecord(refreshed) : null });
}
