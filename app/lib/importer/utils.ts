import type { ImportSourceId, ParserResult, ProductImportDraft, ProductPrice } from './types';

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₩': 'KRW',
  '₹': 'INR',
  'C$': 'CAD',
  'A$': 'AUD',
};

export const normalizeAssetUrl = (candidate: string | undefined | null, base: string): string | null => {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, base).href;
  } catch {
    return null;
  }
};

export const dedupeStrings = (values: (string | undefined | null)[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  });
  return result;
};

export const parsePriceText = (value: string | undefined | null): ProductPrice | undefined => {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  const numericMatch = trimmed.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  const symbolMatch = trimmed.match(/(^[^\d\s]+)/);
  const amount = numericMatch ? Number.parseFloat(numericMatch[1]) : undefined;
  let currency = symbolMatch ? symbolMatch[1] : undefined;
  if (currency && CURRENCY_SYMBOL_MAP[currency]) {
    currency = CURRENCY_SYMBOL_MAP[currency];
  } else if (currency && currency.length === 1 && CURRENCY_SYMBOL_MAP[currency]) {
    currency = CURRENCY_SYMBOL_MAP[currency];
  } else if (!currency) {
    const currencyMatch = trimmed.match(/([A-Z]{3})/);
    currency = currencyMatch ? currencyMatch[1] : undefined;
  }

  return {
    amount,
    currency,
    text: trimmed,
  };
};

export const createEmptyDraft = (url: string): ProductImportDraft => ({
  url,
  images: [],
  sourceTrail: [],
  warnings: [],
  rawSections: {},
  scrapedAt: new Date().toISOString(),
});

export const applyParserResult = (
  draft: ProductImportDraft,
  result: ParserResult,
  options: { wasFallback: boolean }
) => {
  const usedFields: (keyof typeof result.fields)[] = [];
  const { fields } = result;

  if (fields.title && !draft.title) {
    draft.title = fields.title.trim();
    usedFields.push('title');
  }

  if (fields.brand && !draft.brand) {
    draft.brand = fields.brand.trim();
    usedFields.push('brand');
  }

  if (fields.color && !draft.color) {
    draft.color = fields.color.trim();
    usedFields.push('color');
  }

  if (fields.description && !draft.description) {
    draft.description = fields.description.trim();
    usedFields.push('description');
  }

  if (fields.sku && !draft.sku) {
    draft.sku = fields.sku.trim();
    usedFields.push('sku');
  }

  if (fields.price) {
    draft.price = {
      amount: draft.price?.amount ?? fields.price.amount,
      currency: draft.price?.currency ?? fields.price.currency,
      text: draft.price?.text ?? fields.price.text,
    };
    usedFields.push('price');
  }

  if (Array.isArray(fields.images) && fields.images.length > 0) {
    const before = draft.images.length;
    const additions = fields.images
      .map((src) => normalizeImageCandidate(src, draft.url))
      .filter((src): src is string => Boolean(src));
    draft.images = dedupeStrings([...draft.images, ...additions]);
    if (draft.images.length > before) {
      usedFields.push('images');
    }
  }

  if (result.raw) {
    draft.rawSections[result.sourceId] = result.raw;
  }

  if (usedFields.length > 0 || result.note) {
    draft.sourceTrail.push({
      id: result.sourceId,
      usedFields: usedFields as (keyof typeof result.fields)[],
      wasFallback: options.wasFallback,
      note: result.note,
    });
  }
};

export const normalizeImageCandidate = (
  candidate: string | undefined | null,
  baseUrl: string
): string | null => normalizeAssetUrl(candidate, baseUrl);

export const shouldFallbackToPlaywright = (draft: ProductImportDraft): boolean => {
  const missingCriticalFields = !draft.title || draft.images.length === 0;
  return missingCriticalFields;
};

export const recordWarning = (draft: ProductImportDraft, warning: string) => {
  draft.warnings.push(warning);
};

export const parserResult = (
  sourceId: ImportSourceId,
  fields: ParserResult['fields'],
  raw?: Record<string, unknown>,
  note?: string
): ParserResult => ({
  sourceId,
  fields,
  raw,
  note,
});
