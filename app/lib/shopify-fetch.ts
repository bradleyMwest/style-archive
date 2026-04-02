import { SHOPIFY_PRODUCT_PATH } from './shopify';

const SHOPIFY_JSON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript;q=0.9,*/*;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const buildShopifyJsonCandidates = (url: string): string[] => {
  const urlObj = new URL(url);
  const basePath = urlObj.pathname.replace(/\/$/, '');
  const normalized = `${urlObj.origin}${basePath}`;
  const candidates = [
    `${normalized}.json`,
    `${normalized}?view=json`,
    `${normalized}?format=json`,
    `${normalized}?view=ajax`,
    `${normalized}.js`,
  ];
  return Array.from(new Set(candidates));
};

type ShopifyPayload = {
  product?: unknown;
  products?: unknown[];
};

const extractShopifyProduct = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as ShopifyPayload;
  if (candidate.product) return candidate.product;
  if (Array.isArray(candidate.products) && candidate.products.length > 0) {
    return candidate.products[0];
  }
  return payload;
};

export const fetchShopifyProduct = async (url: string): Promise<unknown> => {
  if (!SHOPIFY_PRODUCT_PATH.test(new URL(url).pathname)) {
    throw new Error('URL does not appear to be a Shopify product path');
  }

  const candidates = buildShopifyJsonCandidates(url);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          ...SHOPIFY_JSON_HEADERS,
          Referer: url,
        },
      });

      if (!response.ok) {
        lastError = new Error(`Shopify JSON request failed with status ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const isJsonLike = contentType.includes('json') || contentType.includes('javascript');
      if (!isJsonLike) {
        lastError = new Error(`Shopify JSON request returned unexpected content-type (${contentType || 'unknown'})`);
        await response.text().catch(() => null);
        continue;
      }

      let payload: unknown;
      try {
        payload = contentType.includes('javascript') ? await response.text() : await response.json();
        if (typeof payload === 'string') {
          const trimmed = payload.trim();
          const jsonStart = trimmed.indexOf('{');
          const jsonEnd = trimmed.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            payload = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
          } else {
            throw new Error('Shopify JS response missing JSON payload');
          }
        }
      } catch (parseError) {
        lastError = parseError;
        continue;
      }

      const product = extractShopifyProduct(payload);

      if (product) {
        return product;
      }

      lastError = new Error('Shopify JSON missing product field');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to fetch Shopify product JSON');
};
