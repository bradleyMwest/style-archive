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
  options: { wasFallback: boolean; overwriteExisting?: boolean }
) => {
  const usedFields: (keyof typeof result.fields)[] = [];
  const { fields } = result;
  const allowOverwrite = Boolean(options.overwriteExisting);

  const assignString = (value: string | undefined, targetKey: keyof ProductImportDraft) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = draft[targetKey];
    if (!current || allowOverwrite) {
      (draft as unknown as Record<string, unknown>)[targetKey] = trimmed;
      usedFields.push(targetKey as keyof typeof result.fields);
    }
  };

  assignString(fields.title, 'title');
  assignString(fields.brand, 'brand');
  assignString(fields.type, 'type');
  assignString(fields.color, 'color');
  assignString(fields.size, 'size');
  assignString(fields.material, 'material');
  assignString(fields.description, 'description');
  assignString(fields.sku, 'sku');

  if (fields.price) {
    const chooseValue = <T>(current: T | undefined, incoming: T | undefined): T | undefined =>
      allowOverwrite ? incoming ?? current : current ?? incoming;
    draft.price = {
      amount: chooseValue(draft.price?.amount, fields.price.amount),
      currency: chooseValue(draft.price?.currency, fields.price.currency),
      text: chooseValue(draft.price?.text, fields.price.text),
    };
    usedFields.push('price');
  }

  if (Array.isArray(fields.tags) && fields.tags.length > 0) {
    const normalizedTags = dedupeStrings(fields.tags);
    if (normalizedTags.length > 0) {
      if (allowOverwrite || !draft.tags || draft.tags.length === 0) {
        draft.tags = normalizedTags;
      } else {
        draft.tags = dedupeStrings([...(draft.tags ?? []), ...normalizedTags]);
      }
      usedFields.push('tags');
    }
  }

  if (Array.isArray(fields.images) && fields.images.length > 0) {
    const additions = fields.images
      .map((src) => normalizeImageCandidate(src, draft.url))
      .filter((src): src is string => Boolean(src));
    const before = draft.images.length;
    if (allowOverwrite) {
      draft.images = dedupeStrings([...additions, ...draft.images]);
    } else {
      draft.images = dedupeStrings([...draft.images, ...additions]);
    }
    if (draft.images.length !== before) {
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
