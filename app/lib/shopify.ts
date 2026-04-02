const SHOPIFY_PRODUCT_PATH = /\/products\/([^/?#]+)/i;

export const isLikelyShopifyProductUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return SHOPIFY_PRODUCT_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
};

type ShopifyVariant = {
  [key: `option${number}`]: string | null | undefined;
};

type ShopifyOption = {
  name?: string;
};

type ShopifyImage = {
  src?: string;
};

export type ShopifyProduct = {
  title?: string;
  product_type?: string;
  tags?: string | string[];
  variants?: ShopifyVariant[];
  options?: ShopifyOption[];
  images?: ShopifyImage[];
  image?: ShopifyImage;
  vendor?: string;
};

export const normalizeShopifyMetadata = (product: ShopifyProduct, listingUrl: string) => {
  const tags: string[] =
    typeof product.tags === 'string'
      ? product.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : Array.isArray(product.tags)
        ? product.tags
            .filter((tag: string) => typeof tag === 'string' && tag.trim().length > 0)
            .map((tag: string) => tag.trim())
        : [];

  const firstVariant =
    Array.isArray(product.variants) && product.variants.length > 0 ? product.variants[0] : null;
  const optionNames: string[] = Array.isArray(product.options)
    ? product.options.map((opt: ShopifyOption) =>
        typeof opt?.name === 'string' ? opt.name.toLowerCase() : ''
      )
    : [];

  const findOptionValue = (keyword: string) => {
    const index = optionNames.findIndex((name) => name.includes(keyword));
    if (index === -1 || !firstVariant) return undefined;
    const key = `option${index + 1}` as const;
    const value = firstVariant[key];
    return typeof value === 'string' ? value : undefined;
  };

  const color = findOptionValue('color') || findOptionValue('colour');
  const size = findOptionValue('size');

  const images: string[] = Array.isArray(product.images)
    ? product.images
        .map((img: ShopifyImage) => (typeof img?.src === 'string' ? img.src.trim() : ''))
        .filter((src: string) => src.length > 0)
    : [];

  return {
    name: product.title || '',
    type: product.product_type || '',
    color: color || '',
    size: size || '',
    image: images[0] || (typeof product.image?.src === 'string' ? product.image.src : ''),
    tags,
    material: undefined,
    brand: product.vendor || '',
    listingUrl,
    images: images.length > 0 ? images : undefined,
  };
};

export type ShopifyMetadata = ReturnType<typeof normalizeShopifyMetadata>;

export { SHOPIFY_PRODUCT_PATH };
