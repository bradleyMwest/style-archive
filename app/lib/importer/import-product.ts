import { load } from 'cheerio';
import { parseJsonLd } from './parsers/jsonld';
import { parseOpenGraph } from './parsers/openGraph';
import { parseSimpleSelectors } from './parsers/simpleSelectors';
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

const parserSequence = [parseJsonLd, parseOpenGraph, parseSimpleSelectors];

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

  const llmResult = await enrichDraftWithLlm(draft);
  if (llmResult) {
    applyParserResult(draft, llmResult, { wasFallback: true });
  }

  return draft;
};
