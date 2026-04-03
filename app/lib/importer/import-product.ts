import { load } from 'cheerio';
import { parseJsonLd } from './parsers/jsonld';
import { parseOpenGraph } from './parsers/openGraph';
import { parseSimpleSelectors } from './parsers/simpleSelectors';
import { parseMetaProduct } from './parsers/metaProduct';
import { renderWithPlaywright } from './playwright';
import {
  applyParserResult,
  createEmptyDraft,
  parserResult,
  recordWarning,
  shouldFallbackToPlaywright,
} from './utils';
import { enrichDraftWithLlm } from './llm';
import type { ImportProductOptions, ParserResult as ParserOutcome, ProductImportDraft } from './types';
import { isLikelyShopifyProductUrl, normalizeShopifyMetadata } from '../shopify';
import { fetchShopifyProduct } from '../shopify-fetch';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua':
    '"Not A;Brand";v="8", "Chromium";v="123", "Google Chrome";v="123"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
} as const;

const SESSION_BOOTSTRAP_HEADERS = {
  ...BROWSER_HEADERS,
};

const parserSequence = [parseJsonLd, parseOpenGraph, parseMetaProduct, parseSimpleSelectors];

type RetailerStrategy = {
  matcher: (url: URL) => boolean;
  parse: (url: string) => Promise<ParserOutcome | null>;
};

const retailerStrategies: RetailerStrategy[] = [
  {
    matcher: (url) => isLikelyShopifyProductUrl(url.href),
    parse: async (url) => {
      try {
        const product = await fetchShopifyProduct(url);
        const metadata = normalizeShopifyMetadata(product, url);
        const images = metadata.images ?? (metadata.image ? [metadata.image] : undefined);
        return parserResult(
          'retailer_strategy',
          {
            title: metadata.name || undefined,
            brand: metadata.brand || undefined,
            color: metadata.color || undefined,
            images,
          },
          product,
          'Shopify storefront JSON'
        );
      } catch (error) {
        console.warn('Shopify strategy failed', error);
        return null;
      }
    },
  },
];

type ProductOptionValue = {
  value?: string;
  displayName?: string;
};

type ProductOption = {
  name?: string;
  values?: ProductOptionValue[];
};

type ProductImage = {
  options?: {
    name?: string;
    values?: string[];
  }[];
  image?: {
    url?: string;
  };
};

type ProductVariantOption = {
  name?: string;
  value?: string;
};

type ProductVariant = {
  price?: number | string;
  options?: ProductVariantOption[];
};

type NextDataProduct = {
  id?: string | number;
  slug?: string;
  title?: string;
  description?: string;
  productTypeName?: string;
  productBrandInfo?: {
    brandName?: string;
  };
  productOptions?: ProductOption[];
  images?: ProductImage[];
  variants?: ProductVariant[];
};

const slugify = (value?: string | null) =>
  value ? value.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';

const ensureAbsoluteUrl = (input: string | null | undefined, base: URL) => {
  if (!input) return null;
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  if (input.startsWith('//')) {
    return `${base.protocol}${input}`;
  }
  if (input.startsWith('/')) {
    return `${base.origin}${input}`;
  }
  return input;
};

const normalizeProductType = (typeValue?: string | null, title?: string | null) => {
  const target = `${typeValue || ''} ${title || ''}`.toLowerCase();
  if (/(dress|gown|skirt)/.test(target)) return 'dress';
  if (/(jacket|coat|blazer|outerwear)/.test(target)) return 'jacket';
  if (/(shoe|sneaker|boot|loafer|sandal|heel)/.test(target)) return 'shoes';
  if (/(pant|trouser|chino|jean|denim|short|legging)/.test(target)) return 'pants';
  if (/(shirt|tee|t-shirt|top|sweater|hoodie|polo|henley)/.test(target)) return 'shirt';
  if (/(bag|belt|hat|cap|scarf|glove|sock|wallet|accessor)/.test(target)) return 'accessory';
  return undefined;
};

const extractNextDataProduct = (html: string): NextDataProduct | null => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]);
    return payload?.props?.pageProps?.pageData?.context?.pageDataJson?.product ?? null;
  } catch (error) {
    console.warn('Unable to parse __NEXT_DATA__ payload', error);
    return null;
  }
};

const buildNextDataParserResult = (product: NextDataProduct, normalizedUrl: URL): ParserOutcome | null => {
  if (!product) return null;

  const colorSlug = slugify(normalizedUrl.searchParams.get('color'));
  const sizeSlug = slugify(normalizedUrl.searchParams.get('size'));
  const colorOption = product?.productOptions?.find(
    (opt) => opt?.name?.toLowerCase() === 'color'
  );

  const matchedColorValue = colorOption?.values?.find((entry) => {
    const value = entry?.value || entry?.displayName;
    return value && slugify(value) === colorSlug;
  });
  const selectedColor = matchedColorValue?.value || matchedColorValue?.displayName || null;
  const selectedColorSlug = slugify(selectedColor);

  const images = product.images ?? [];

  const selectedImages =
    selectedColorSlug.length > 0
      ? images.filter((entry) =>
          entry?.options?.some(
            (opt) =>
              opt?.name?.toLowerCase() === 'color' &&
              opt?.values?.some((value) => slugify(value) === selectedColorSlug)
          )
        )
      : [];

  const orderedImages = [...selectedImages, ...images]
    .map((entry) => ensureAbsoluteUrl(entry?.image?.url ?? null, normalizedUrl))
    .filter((url): url is string => typeof url === 'string')
    .filter((url, index, arr) => arr.indexOf(url) === index);

  const variants = product.variants ?? [];
  const matchedVariant =
    variants.find((variant) => {
      const colorValue = slugify(
        variant?.options?.find((opt) => opt?.name?.toLowerCase() === 'color')?.value
      );
      const sizeValue = slugify(
        variant?.options?.find((opt) => opt?.name?.toLowerCase() === 'size')?.value
      );
      const colorMatches = selectedColorSlug ? colorValue === selectedColorSlug : true;
      const sizeMatches = sizeSlug ? sizeValue === sizeSlug : true;
      return colorMatches && sizeMatches;
    }) || variants[0];

  const priceAmount =
    typeof matchedVariant?.price === 'number'
      ? matchedVariant.price
      : matchedVariant?.price
        ? Number(matchedVariant.price)
        : undefined;

  const typeValue = normalizeProductType(product?.productTypeName, product?.title);

  const baseTitle = product?.title ?? '';
  const computedTitle =
    baseTitle && selectedColor ? `${baseTitle} (${selectedColor})` : baseTitle || selectedColor || undefined;

  const fields: ParserOutcome['fields'] = {
    title: computedTitle,
    description: product?.description ?? undefined,
    brand: product?.productBrandInfo?.brandName ?? undefined,
    color: selectedColor ?? undefined,
    type: typeValue,
    images: orderedImages.length > 0 ? orderedImages : undefined,
    tags: selectedColor ? [selectedColor] : undefined,
    price: priceAmount
      ? {
          amount: priceAmount,
          currency: 'USD',
        }
      : undefined,
  };

  const hasData = Object.values(fields).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });

  if (!hasData) {
    return null;
  }

  return parserResult(
    'next_data',
    fields,
    { productId: product?.id, slug: product?.slug, color: selectedColor },
    '__NEXT_DATA__ product payload'
  );
};

const inferDraftType = (draft: ProductImportDraft, normalizedUrl: URL) => {
  if (draft.type) return;
  const guess =
    normalizeProductType(draft.type, draft.title) ||
    normalizeProductType(undefined, normalizedUrl.pathname.replace(/[-_/]/g, ' '));
  if (guess) {
    draft.type = guess;
  }
};

const extractCookieHeader = (response: Response) => {
  type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };
  const enhanced = response.headers as HeadersWithSetCookie;
  const cookies = enhanced.getSetCookie?.();
  if (cookies && cookies.length > 0) {
    return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
  }
  const legacy = response.headers.get('set-cookie');
  return legacy ? legacy.split(';')[0] : '';
};

const bootstrapSessionCookie = async (origin: string) => {
  try {
    const response = await fetch(origin, {
      headers: SESSION_BOOTSTRAP_HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) return '';
    const cookieHeader = extractCookieHeader(response);
    return cookieHeader;
  } catch (error) {
    console.warn('Unable to bootstrap session cookie', error);
    return '';
  }
};

const fetchHtml = async (url: string): Promise<string> => {
  const target = new URL(url);

  const performFetch = async (cookieHeader?: string) =>
    fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      redirect: 'follow',
    });

  let response = await performFetch();

  if ((response.status === 401 || response.status === 403) && target.origin) {
    const cookieHeader = await bootstrapSessionCookie(target.origin);
    if (cookieHeader) {
      response = await performFetch(cookieHeader);
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch product page (status ${response.status})`);
  }

  return response.text();
};

const runParsers = (draft: ProductImportDraft, html: string, wasFallback: boolean) => {
  const $ = load(html);
  parserSequence.forEach((parser) => {
    const result = parser($);
    if (result) {
      applyParserResult(draft, result, { wasFallback });
    }
  });
};

const shouldRunRetailerStrategy = (draft: ProductImportDraft) => {
  return !draft.title || draft.images.length === 0 || !draft.brand;
};

export const importProductFromUrl = async (
  inputUrl: string,
  options?: ImportProductOptions
): Promise<ProductImportDraft> => {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('URL is required');
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(inputUrl.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL';
    throw new Error(`Invalid URL: ${message}`);
  }

  const draft = createEmptyDraft(normalizedUrl.href);

  try {
    const html = await fetchHtml(normalizedUrl.href);
    runParsers(draft, html, false);
    const nextProduct = extractNextDataProduct(html);
    if (nextProduct) {
      const nextResult = buildNextDataParserResult(nextProduct, normalizedUrl);
      if (nextResult) {
        applyParserResult(draft, nextResult, { wasFallback: false, overwriteExisting: true });
      }
    }
  } catch (error) {
    recordWarning(draft, `Primary fetch failed: ${(error as Error).message}`);
  }

  if (shouldRunRetailerStrategy(draft)) {
    for (const strategy of retailerStrategies) {
      if (!strategy.matcher(normalizedUrl)) continue;
      const result = await strategy.parse(normalizedUrl.href);
      if (result) {
        applyParserResult(draft, result, { wasFallback: true });
        break;
      }
    }
  }

  if (shouldFallbackToPlaywright(draft) || options?.preferPlaywright) {
    const rendered = await renderWithPlaywright(normalizedUrl.href, options?.playwrightTimeoutMs);
    if (rendered?.html) {
      recordWarning(draft, 'Rendered via Playwright to capture client-side metadata');
      runParsers(draft, rendered.html, true);
    } else {
      recordWarning(draft, 'Playwright fallback unavailable or failed');
    }
  }

  if (!options?.skipLlm) {
    const llmResult = await enrichDraftWithLlm(draft);
    if (llmResult) {
      applyParserResult(draft, llmResult, { wasFallback: true });
    }
  }

  inferDraftType(draft, normalizedUrl);

  return draft;
};
