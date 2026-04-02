import type { CheerioAPI } from 'cheerio';
import { parserResult, parsePriceText } from '../utils';
import type { ParserResult } from '../types';

type JsonLdNode = Record<string, unknown>;

const isProductNode = (node: JsonLdNode) => {
  const typeValue = node['@type'];
  if (!typeValue) return false;
  if (Array.isArray(typeValue)) {
    return typeValue.some((type) => typeof type === 'string' && type.toLowerCase().includes('product'));
  }
  return typeof typeValue === 'string' && typeValue.toLowerCase().includes('product');
};

const flattenGraph = (node: unknown): JsonLdNode[] => {
  if (!node) return [];
  if (Array.isArray(node)) {
    return node.flatMap((child) => flattenGraph(child));
  }
  if (typeof node === 'object' && node !== null && Array.isArray((node as JsonLdNode)['@graph'])) {
    return flattenGraph((node as JsonLdNode)['@graph']);
  }
  return typeof node === 'object' && node !== null ? [node as JsonLdNode] : [];
};

const extractBrand = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const brandNode = value as JsonLdNode;
    if (typeof brandNode.name === 'string') return brandNode.name;
    if (typeof brandNode['@id'] === 'string') return brandNode['@id'];
  }
  return undefined;
};

const extractColor = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const color = value.find((entry) => typeof entry === 'string');
    return typeof color === 'string' ? color : undefined;
  }
  return undefined;
};

const extractDescription = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === 'string');
  }
  return undefined;
};

const extractImages = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') return [value];
  return [];
};

export const parseJsonLd = ($: CheerioAPI): ParserResult | null => {
  const scripts = $('script[type="application/ld+json"]');
  const nodes: JsonLdNode[] = [];

  scripts.each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      nodes.push(...flattenGraph(parsed));
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  });

  const productNode = nodes.find(isProductNode);
  if (!productNode) return null;

  const images = extractImages(productNode.image);
  type OfferNode = {
    price?: string;
    priceCurrency?: string;
    priceSpecification?: {
      price?: string;
      priceCurrency?: string;
    };
  };
  const offer: OfferNode | null =
    typeof productNode.offers === 'object' && productNode.offers
      ? (productNode.offers as OfferNode)
      : null;
  const price = offer ? parsePriceText(offer.price || offer.priceSpecification?.price) : undefined;
  const currencyFromOffer = offer
    ? offer.priceCurrency || offer.priceSpecification?.priceCurrency
    : undefined;

  const priceWithCurrency = price
    ? {
        ...price,
        currency: price.currency ?? (typeof currencyFromOffer === 'string' ? currencyFromOffer : undefined),
      }
    : undefined;

  return parserResult(
    'json_ld',
    {
      title: typeof productNode.name === 'string' ? productNode.name : undefined,
      brand: extractBrand(productNode.brand),
      color: extractColor(productNode.color || productNode['colorway']),
      description: extractDescription(productNode.description),
      images,
      price: priceWithCurrency,
      sku: typeof productNode.sku === 'string' ? productNode.sku : undefined,
    },
    productNode
  );
};
