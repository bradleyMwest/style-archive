import type { CheerioAPI } from 'cheerio';
import { parserResult, parsePriceText } from '../utils';
import type { ParserResult } from '../types';

const textSelectors = {
  title: ['h1', '.product-title', '.ProductName', '[data-product-title]', '.pdp-title'],
  brand: ['.product-brand', '.BrandName', '[data-product-brand]', '.pdp-brand'],
  description: [
    '.product-description',
    '[data-product-description]',
    '#productDescription',
    '.ProductDescription',
    '.description',
  ],
  price: ['.price', '.ProductPrice', '[data-price]', '.pdp-price'],
};

const imageContainers = ['.product-gallery img', '.pdp-gallery img', '.product-images img', '[data-product-image]'];

const attributeContainers = ['.product-attributes', '.ProductMeta', '.product-details', '.pdp-attributes'];

const pickText = ($: CheerioAPI, selectors: string[]): string | undefined => {
  for (const selector of selectors) {
    const value = $(selector).first().text();
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const extractColorFromAttributes = ($: CheerioAPI): string | undefined => {
  for (const selector of attributeContainers) {
    const text = $(selector).text();
    if (!text) continue;
    const match = text.match(/color[:\s]+([^\n]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
};

const collectImages = ($: CheerioAPI): string[] => {
  const images = new Set<string>();
  imageContainers.forEach((selector) => {
    $(selector)
      .toArray()
      .forEach((node) => {
        const src = $(node).attr('data-src') || $(node).attr('data-original') || $(node).attr('src');
        if (src && src.trim().length > 0) {
          images.add(src.trim());
        }
      });
  });
  return Array.from(images);
};

export const parseSimpleSelectors = ($: CheerioAPI): ParserResult | null => {
  const title = pickText($, textSelectors.title);
  const brand = pickText($, textSelectors.brand);
  const description = pickText($, textSelectors.description);
  const priceText = pickText($, textSelectors.price);
  const color = extractColorFromAttributes($);
  const images = collectImages($);
  const price = priceText ? parsePriceText(priceText) : undefined;

  if (!title && !brand && !color && images.length === 0 && !price) {
    return null;
  }

  return parserResult(
    'selectors',
    {
      title,
      brand,
      description,
      color,
      images: images.length > 0 ? images : undefined,
      price,
    },
    {
      title,
      brand,
      description,
      color,
      images,
      priceText,
    }
  );
};
