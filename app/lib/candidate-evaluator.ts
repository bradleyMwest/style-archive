import type { CandidateItem, CandidateVerdict, Item } from '@prisma/client';
import sharp from 'sharp';
import { downloadHeroImage } from './hero-image';

type WardrobeItem = Pick<
  Item,
  'id' | 'type' | 'color' | 'tags' | 'brand' | 'material' | 'name' | 'listingUrl' | 'heroImageData' | 'heroImageMimeType' | 'image'
>;

type CandidateInput = Pick<
  CandidateItem,
  'title' | 'type' | 'color' | 'material' | 'tags' | 'description' | 'brand' | 'url' | 'heroImage' | 'images'
>;

export type CandidateEvaluationResult = {
  verdict: CandidateVerdict;
  explanation: string;
  compatibilityScore: number;
  redundancyScore: number;
  gapScore: number;
  versatilityScore: number;
  reasoning: string[];
};

const CATEGORY_MAP: Record<string, string> = {
  top: 'top',
  shirt: 'top',
  sweater: 'top',
  tee: 'top',
  tshirt: 'top',
  tank: 'top',
  polo: 'top',
  blouse: 'top',
  jacket: 'outerwear',
  coat: 'outerwear',
  trench: 'outerwear',
  blazer: 'outerwear',
  hoodie: 'outerwear',
  pant: 'bottom',
  trouser: 'bottom',
  chino: 'bottom',
  jean: 'bottom',
  denim: 'bottom',
  short: 'bottom',
  skirt: 'bottom',
  dress: 'onepiece',
  jumpsuit: 'onepiece',
  shoe: 'shoe',
  boot: 'shoe',
  loafer: 'shoe',
  sandal: 'shoe',
  sneaker: 'shoe',
  accessory: 'accessory',
  bag: 'accessory',
  belt: 'accessory',
  hat: 'accessory',
  scarf: 'accessory',
};

const CATEGORY_PARTNERS: Record<string, string[]> = {
  top: ['bottom', 'shoe', 'accessory', 'outerwear'],
  bottom: ['top', 'shoe', 'outerwear'],
  outerwear: ['top', 'bottom', 'shoe'],
  onepiece: ['outerwear', 'shoe', 'accessory'],
  shoe: ['top', 'bottom', 'onepiece'],
  accessory: ['top', 'bottom', 'onepiece'],
  misc: ['top', 'bottom', 'shoe', 'outerwear'],
};

const normalizeCategory = (rawType?: string | null): string => {
  if (!rawType) return 'misc';
  const normalized = rawType.toLowerCase();
  const direct = CATEGORY_MAP[normalized];
  if (direct) return direct;
  const match = Object.keys(CATEGORY_MAP).find((key) => normalized.includes(key));
  return match ? CATEGORY_MAP[match] : 'misc';
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const splitTags = (value?: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    : [];

const IMAGE_VECTOR_SIZE = 24;
const IMAGE_SIMILARITY_WEIGHT = 40;
const REDUNDANCY_THRESHOLD = 45;

const parseImageJson = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim())
      : [];
  } catch {
    return [];
  }
};

const resolveCandidateImageUrl = (candidate: CandidateInput): string | null => {
  if (candidate.heroImage && candidate.heroImage.trim().length > 0) {
    return candidate.heroImage;
  }
  const parsed = parseImageJson(candidate.images);
  return parsed[0] ?? null;
};

const buildImageVectorFromBuffer = async (buffer: Buffer): Promise<Float32Array | null> => {
  try {
    const { data } = await sharp(buffer)
      .toColorspace('srgb')
      .resize(IMAGE_VECTOR_SIZE, IMAGE_VECTOR_SIZE, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const vector = new Float32Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      vector[i] = data[i] / 255;
    }
    return vector;
  } catch (error) {
    console.warn('Image vector build failed', error);
    return null;
  }
};

const buildImageVectorFromSource = async (params: {
  data?: Buffer | Uint8Array | null;
  url?: string | null;
}): Promise<Float32Array | null> => {
  if (params.data && (params.data as Buffer).length > 0) {
    const buffer = Buffer.isBuffer(params.data) ? params.data : Buffer.from(params.data);
    const vector = await buildImageVectorFromBuffer(buffer);
    if (vector) return vector;
  }

  if (params.url && params.url.trim().length > 0) {
    const downloaded = await downloadHeroImage(params.url);
    if (downloaded?.data) {
      return buildImageVectorFromBuffer(downloaded.data);
    }
  }

  return null;
};

const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const tokenize = (value?: string | null): string[] =>
  value
    ? value
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
    : [];

const buildColorTokens = (value?: string | null) => tokenize(value);

const normalizeString = (value?: string | null) => (value ? value.trim().toLowerCase() : null);

const normalizeUrlKey = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.endsWith('/') && parsed.pathname !== '/' ? parsed.pathname.slice(0, -1) : parsed.pathname;
    return `${parsed.hostname}${pathname}`;
  } catch {
    const sanitized = value
      .replace(/^https?:\/\//i, '')
      .split(/[?#]/)[0]
      .replace(/\/+$/, '');
    return sanitized.length > 0 ? sanitized : null;
  }
};

type CandidateFeatures = {
  colorTokens: string[];
  brand: string | null;
  material: string | null;
  textTokens: string[];
  urlKey: string | null;
};

const buildCandidateFeatures = (candidate: CandidateInput): CandidateFeatures => ({
  colorTokens: buildColorTokens(candidate.color),
  brand: normalizeString(candidate.brand),
  material: normalizeString(candidate.material),
  textTokens: tokenize(candidate.title ?? candidate.description ?? ''),
  urlKey: normalizeUrlKey(candidate.url),
});

const computeItemSimilarityScore = (
  item: WardrobeItem,
  features: CandidateFeatures,
  imageVectors: { candidate?: Float32Array | null; wardrobe?: Float32Array | null } = {}
): number => {
  const itemUrlKey = normalizeUrlKey(item.listingUrl);
  if (features.urlKey && itemUrlKey && features.urlKey === itemUrlKey) {
    return 100;
  }

  let score = 0;
  const candidateColorTokens = features.colorTokens;
  const itemColorTokens = buildColorTokens(item.color);
  const colorMatch =
    candidateColorTokens.length === 0 ||
    itemColorTokens.length === 0 ||
    candidateColorTokens.some((token) => itemColorTokens.includes(token));
  if (colorMatch) {
    score += 30;
  }

  const candidateBrand = features.brand;
  const brandMatch =
    candidateBrand && item.brand ? normalizeString(item.brand) === candidateBrand : false;
  if (brandMatch) {
    score += 25;
  }

  const candidateMaterial = features.material;
  const materialMatch =
    candidateMaterial && item.material
      ? normalizeString(item.material) === candidateMaterial
      : false;
  if (materialMatch) {
    score += 10;
  }

  const candidateTextTokens = features.textTokens;
  const itemTextTokens = tokenize(item.name);
  const sharedTextTokens = candidateTextTokens.filter((token) => itemTextTokens.includes(token)).length;
  if (sharedTextTokens > 0) {
    score += Math.min(sharedTextTokens * 4, 24);
  }

  if (brandMatch && sharedTextTokens >= 2) {
    score += 8;
  }

  if (colorMatch && sharedTextTokens >= 3) {
    score += 6;
  }

  if (imageVectors.candidate && imageVectors.wardrobe) {
    const similarity = cosineSimilarity(imageVectors.candidate, imageVectors.wardrobe);
    if (similarity > 0) {
      score += Math.min(Math.round(similarity * IMAGE_SIMILARITY_WEIGHT), IMAGE_SIMILARITY_WEIGHT);
    }
  }

  return score;
};

const buildReasoning = (result: CandidateEvaluationResult): string[] => [
  `Compatibility score at ${result.compatibilityScore} reflects how many outfits we can make with existing wardrobe items.`,
  `Redundancy score at ${result.redundancyScore} indicates ${result.redundancyScore > 60 ? 'high overlap' : 'minimal overlap'} with what you already own.`,
  `Gap-fill score of ${result.gapScore} is based on how underrepresented this category is in your closet.`,
  `Versatility score at ${result.versatilityScore} estimates how many distinct outfit contexts this piece can support.`,
];

export const evaluateCandidate = async (
  candidate: CandidateInput,
  wardrobe: WardrobeItem[]
): Promise<CandidateEvaluationResult> => {
  const candidateFeatures = buildCandidateFeatures(candidate);
  const candidateCategory = normalizeCategory(candidate.type);
  const partnerCategories = CATEGORY_PARTNERS[candidateCategory] ?? CATEGORY_PARTNERS.misc;
  const wardrobeSize = Math.max(wardrobe.length, 1);
  const candidateImageUrl = resolveCandidateImageUrl(candidate);
  const candidateImageVector = candidateImageUrl
    ? await buildImageVectorFromSource({ url: candidateImageUrl })
    : null;

  const wardrobeWithCategories = wardrobe.map((item) => ({
    ...item,
    category: normalizeCategory(item.type),
  }));

  const complementaryItems = wardrobeWithCategories.filter((item) =>
    partnerCategories.includes(item.category)
  );
  const compatibilityScore = clampScore((complementaryItems.length / wardrobeSize) * 100 + 10);

  const similarItems = wardrobeWithCategories.filter(
    (item) => item.category === candidateCategory
  );
  const redundantMatchesRaw = await Promise.all(
    similarItems.map(async (item) => {
      let wardrobeImageVector: Float32Array | null = null;
      if (candidateImageVector) {
        wardrobeImageVector = await buildImageVectorFromSource({
          data: item.heroImageData,
          url: item.image,
        });
      }
      const score = computeItemSimilarityScore(item, candidateFeatures, {
        candidate: candidateImageVector,
        wardrobe: wardrobeImageVector,
      });
      return score >= REDUNDANCY_THRESHOLD ? item : null;
    })
  );
  const redundantMatches = redundantMatchesRaw.filter(
    (item): item is (typeof similarItems)[number] => Boolean(item)
  );
  const redundancyScore = clampScore(
    similarItems.length === 0 ? 15 : (redundantMatches.length / Math.max(similarItems.length, 1)) * 100
  );

  const gapScore =
    similarItems.length === 0
      ? 90
      : similarItems.length <= 1
        ? 75
        : similarItems.length <= 3
          ? 55
          : 30;

  const distinctPartnerCategories = new Set(complementaryItems.map((item) => item.category)).size;
  const tagCount = splitTags(candidate.tags).length;
  const versatilityScore = clampScore(distinctPartnerCategories * 20 + tagCount * 3);

  const compositeScore = compatibilityScore + gapScore + versatilityScore - redundancyScore;
  let verdict: CandidateVerdict = 'pass';
  if (compositeScore >= 210 && redundancyScore <= 60) {
    verdict = 'buy';
  } else if (compositeScore >= 160) {
    verdict = 'maybe';
  }

  const explanationParts = [
    verdict === 'buy'
      ? 'Strong wardrobe fit with low redundancy.'
      : verdict === 'maybe'
        ? 'Mixed signals: useful in some outfits but overlaps with existing pieces.'
        : 'Limited incremental value versus current wardrobe.',
  ];
  if (gapScore >= 75) {
    explanationParts.push('Fills an underrepresented category for you.');
  }
  if (redundancyScore > 70) {
    explanationParts.push('Very similar to items you already own.');
  }

  const baseResult: CandidateEvaluationResult = {
    verdict,
    explanation: explanationParts.join(' '),
    compatibilityScore,
    redundancyScore,
    gapScore,
    versatilityScore,
    reasoning: [],
  };

  return {
    ...baseResult,
    reasoning: buildReasoning(baseResult),
  };
};
