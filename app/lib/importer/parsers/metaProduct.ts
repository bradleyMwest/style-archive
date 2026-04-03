import type { CheerioAPI } from 'cheerio';
import { parserResult } from '../utils';
import type { ParserResult } from '../types';

const getContent = ($: CheerioAPI, selectors: string[]): string | undefined => {
  for (const selector of selectors) {
    const value = $(selector).attr('content') || $(selector).attr('value');
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const splitKeywords = (value?: string) =>
  value
    ? value
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
    : [];

export const parseMetaProduct = ($: CheerioAPI): ParserResult | null => {
  const brand =
    getContent($, ['meta[property="product:brand"]', 'meta[name="product:brand"]']) ||
    getContent($, ['meta[property="og:brand"]']);

  const priceAmount =
    getContent($, [
      'meta[property="product:price:amount"]',
      'meta[name="product:price:amount"]',
      'meta[property="og:price:amount"]',
    ]) || undefined;

  const priceCurrency =
    getContent($, [
      'meta[property="product:price:currency"]',
      'meta[name="product:price:currency"]',
      'meta[property="og:price:currency"]',
    ]) || undefined;

  const color =
    getContent($, ['meta[name="color"]', 'meta[property="product:color"]', 'meta[name="product:color"]']) || undefined;

  const size =
    getContent($, ['meta[name="size"]', 'meta[property="product:size"]', 'meta[name="product:size"]']) || undefined;

  const title =
    getContent($, ['meta[property="og:title"]', 'meta[name="title"]']) || $('title').first().text().trim() || undefined;

  const description =
    getContent($, ['meta[property="og:description"]', 'meta[name="description"]']) || undefined;

  const image =
    getContent($, ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[property="product:image"]']) ||
    undefined;

  const keywords = splitKeywords(getContent($, ['meta[name="keywords"]']));
  const tags = new Set<string>(keywords);

  const collectedImages = image ? [image] : [];

  const price =
    priceAmount && !Number.isNaN(Number(priceAmount))
      ? { amount: Number(priceAmount), currency: priceCurrency }
      : undefined;

  const hasData = Boolean(
    title || description || brand || color || size || tags.size > 0 || collectedImages.length > 0 || price
  );

  if (!hasData) {
    return null;
  }

  return parserResult(
    'meta_product',
    {
      title,
      description,
      brand,
      color,
      size,
      tags: tags.size > 0 ? Array.from(tags) : undefined,
      images: collectedImages.length > 0 ? collectedImages : undefined,
      price,
    },
    undefined,
    'Meta product tags'
  );
};
