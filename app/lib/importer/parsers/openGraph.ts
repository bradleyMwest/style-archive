import type { CheerioAPI } from 'cheerio';
import { parsePriceText, parserResult } from '../utils';
import type { ParserResult } from '../types';

const pickMetaContent = ($: CheerioAPI, selectors: string[]): string | undefined => {
  for (const selector of selectors) {
    const value = $(selector).attr('content') || $(selector).attr('value');
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const pickTextContent = ($: CheerioAPI, selectors: string[]): string | undefined => {
  for (const selector of selectors) {
    const value = $(selector).text();
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
};

const imageSelectors = [
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
];

const descriptionSelectors = [
  'meta[property="og:description"]',
  'meta[name="description"]',
  'meta[name="twitter:description"]',
];

const titleSelectors = [
  'meta[property="og:title"]',
  'meta[name="og:title"]',
  'meta[name="twitter:title"]',
  'title',
];

const brandSelectors = [
  'meta[property="product:brand"]',
  'meta[name="product:brand"]',
  'meta[name="brand"]',
];

const colorSelectors = [
  'meta[property="product:color"]',
  'meta[name="color"]',
];

const priceAmountSelectors = [
  'meta[property="product:price:amount"]',
  'meta[property="og:price:amount"]',
  'meta[name="price"]',
];

const currencySelectors = [
  'meta[property="product:price:currency"]',
  'meta[property="og:price:currency"]',
  'meta[name="currency"]',
];

export const parseOpenGraph = ($: CheerioAPI): ParserResult | null => {
  const title = pickMetaContent($, titleSelectors) ?? pickTextContent($, ['h1']);
  const description = pickMetaContent($, descriptionSelectors);
  const brand = pickMetaContent($, brandSelectors);
  const color = pickMetaContent($, colorSelectors);
  const priceAmount = pickMetaContent($, priceAmountSelectors);
  const currency = pickMetaContent($, currencySelectors);
  const parsedPrice = priceAmount ? parsePriceText(priceAmount) : undefined;
  const price = parsedPrice
    ? {
        ...parsedPrice,
        currency: parsedPrice.currency ?? currency,
      }
    : undefined;
  const image = pickMetaContent($, imageSelectors);

  if (!title && !description && !image && !price) {
    return null;
  }

  return parserResult(
    'open_graph',
    {
      title,
      description,
      brand,
      color,
      images: image ? [image] : undefined,
      price,
    },
    {
      title,
      description,
      brand,
      color,
      priceAmount,
      currency,
      image,
    }
  );
};
