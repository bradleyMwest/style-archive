import { Buffer } from 'node:buffer';

type RakutenProduct = {
  id: string;
  name: string;
  brand: string | null;
  merchant: string | null;
  price: string | null;
  currency: string | null;
  image: string | null;
  url: string;
};

type SearchOptions = {
  limit?: number;
  keywordFilters?: string[];
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

const TOKEN_ENDPOINT = process.env.RAKUTEN_ADVERTISING_TOKEN_URL ?? 'https://api.rakutenmarketing.com/token';
const PRODUCT_ENDPOINT =
  process.env.RAKUTEN_ADVERTISING_PRODUCT_SEARCH_URL ?? 'https://api.rakutenmarketing.com/productsearch/1.0';
const CLIENT_ID = process.env.RAKUTEN_ADVERTISING_CLIENT_ID;
const CLIENT_SECRET = process.env.RAKUTEN_ADVERTISING_CLIENT_SECRET;
const DEFAULT_COUNTRY = process.env.RAKUTEN_ADVERTISING_COUNTRY ?? 'US';

let cachedToken: TokenCache | null = null;

const fetchAccessToken = async (): Promise<string | null> => {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    console.warn('Rakuten token request failed', response.status);
    return null;
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    console.warn('Rakuten token response missing access_token');
    return null;
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
};

const toRakutenProductsArray = (payload: unknown): unknown[] => {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const container =
    root.productsearchresults ??
    root['productSearchResults'] ??
    root.results ??
    root['ProductSearchResults'] ??
    null;
  if (!container || typeof container !== 'object') return [];

  const record = container as Record<string, unknown>;
  const candidates = [
    record.products,
    record.product,
    record.results,
    record['productResults'],
    record['productresult'],
    record['productlist'],
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      if (Array.isArray(nested.products)) return nested.products;
      if (Array.isArray(nested.product)) return nested.product;
      if (Array.isArray(nested.items)) return nested.items;
    }
  }

  return [];
};

const normalizeProduct = (raw: Record<string, unknown>): RakutenProduct => {
  const id =
    (typeof raw.productId === 'string' && raw.productId) ||
    (typeof raw['productid'] === 'string' && raw['productid']) ||
    (typeof raw.sku === 'string' && raw.sku) ||
    `${raw.merchant ?? raw.productname ?? Date.now()}`;

  const name =
    (typeof raw.productName === 'string' && raw.productName) ||
    (typeof raw.productname === 'string' && raw.productname) ||
    (typeof raw.name === 'string' && raw.name) ||
    'Rakuten Product';

  const priceValue =
    (typeof raw.saleprice === 'string' && raw.saleprice) ||
    (typeof raw.salePrice === 'string' && raw.salePrice) ||
    (typeof raw.price === 'string' && raw.price) ||
    null;

  const currencyValue =
    (typeof raw.currency === 'string' && raw.currency) ||
    (typeof raw.salepricecurrency === 'string' && raw.salepricecurrency) ||
    (typeof raw.salePriceCurrency === 'string' && raw.salePriceCurrency) ||
    null;

  const imageValue =
    (typeof raw.imageurl === 'string' && raw.imageurl) ||
    (typeof raw.imageUrl === 'string' && raw.imageUrl) ||
    (typeof raw.largeimage === 'string' && raw.largeimage) ||
    (typeof raw.largeImage === 'string' && raw.largeImage) ||
    null;

  const linkValue =
    (typeof raw.linkurl === 'string' && raw.linkurl) ||
    (typeof raw.linkUrl === 'string' && raw.linkUrl) ||
    (typeof raw.link === 'string' && raw.link) ||
    '#';

  return {
    id: String(id),
    name,
    brand:
      (typeof raw.brand === 'string' && raw.brand) ||
      (typeof raw.brandName === 'string' && raw.brandName) ||
      null,
    merchant:
      (typeof raw.merchantname === 'string' && raw.merchantname) ||
      (typeof raw.merchantName === 'string' && raw.merchantName) ||
      (typeof raw.merchant === 'string' && raw.merchant) ||
      null,
    price: priceValue,
    currency: currencyValue,
    image: imageValue,
    url: linkValue,
  };
};

export const searchRakutenProducts = async (keyword: string, options: SearchOptions = {}): Promise<RakutenProduct[]> => {
  if (!keyword || keyword.trim().length === 0) return [];
  const accessToken = await fetchAccessToken();
  if (!accessToken) return [];

  const url = new URL(PRODUCT_ENDPOINT);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('results', String(Math.min(options.limit ?? 6, 20)));
  url.searchParams.set('format', 'json');
  url.searchParams.set('country', DEFAULT_COUNTRY);
  if (options.keywordFilters && options.keywordFilters.length > 0) {
    url.searchParams.set('keywordtype', options.keywordFilters.join(','));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('Rakuten product search failed', response.status);
    return [];
  }

  const payload = await response.json();
  const products = toRakutenProductsArray(payload)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => normalizeProduct(entry))
    .slice(0, options.limit ?? 6);

  return products;
};

export type { RakutenProduct };
