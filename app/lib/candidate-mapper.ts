import type {
  CandidateEvaluation as CandidateEvaluationModel,
  CandidateItem as CandidateItemModel,
} from '@prisma/client';
import type { CandidateEvaluation, CandidateItem } from './types';

const parseTags = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    : [];

const parseImages = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
};

type CandidateWithEval = CandidateItemModel & { evaluation?: CandidateEvaluationModel | null };

const buildEvaluationPayload = (evaluation?: CandidateEvaluationModel | null): CandidateEvaluation | undefined => {
  if (!evaluation) return undefined;
  return {
    id: evaluation.id,
    verdict: evaluation.verdict,
    explanation: evaluation.explanation ?? undefined,
    compatibilityScore: evaluation.compatibilityScore ?? undefined,
    redundancyScore: evaluation.redundancyScore ?? undefined,
    gapScore: evaluation.gapScore ?? undefined,
    versatilityScore: evaluation.versatilityScore ?? undefined,
    reasoning: Array.isArray(evaluation.reasoning)
      ? (evaluation.reasoning as unknown[])
          .filter((entry): entry is string => typeof entry === 'string')
      : undefined,
    createdAt: evaluation.createdAt.toISOString(),
    updatedAt: evaluation.updatedAt.toISOString(),
  };
};

export const mapCandidateRecord = (candidate: CandidateWithEval): CandidateItem => ({
  id: candidate.id,
  url: candidate.url,
  sourceDomain: candidate.sourceDomain ?? undefined,
  title: candidate.title ?? undefined,
  brand: candidate.brand ?? undefined,
  type: candidate.type ?? undefined,
  color: candidate.color ?? undefined,
  size: candidate.size ?? undefined,
  material: candidate.material ?? undefined,
  tags: parseTags(candidate.tags ?? null),
  heroImage: candidate.heroImage ?? undefined,
  images: parseImages(candidate.images ?? null),
  description: candidate.description ?? undefined,
  notes: candidate.notes ?? undefined,
  price: candidate.priceAmount != null
    ? {
        amount: Number(candidate.priceAmount),
        currency: candidate.priceCurrency ?? undefined,
      }
    : undefined,
  status: candidate.status,
  evaluation: buildEvaluationPayload(candidate.evaluation),
  createdAt: candidate.createdAt.toISOString(),
  updatedAt: candidate.updatedAt.toISOString(),
});
