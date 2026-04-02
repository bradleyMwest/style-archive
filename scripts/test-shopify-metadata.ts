import { normalizeShopifyMetadata } from '../app/lib/shopify';

const sampleProduct = {
  title: 'Dusty Olive Venice Wash Slub Curved Hem Tee',
  product_type: 'T-Shirt',
  tags: 'tee,short sleeve,slub cotton,essentials',
  vendor: 'Buck Mason',
  variants: [
    {
      option1: 'Dusty Olive',
      option2: 'Small',
    },
  ],
  options: [
    { name: 'Color' },
    { name: 'Size' },
  ],
  images: [
    {
      src: 'https://cdn.example.com/products/dusty-olive-tee-1.jpg',
    },
    {
      src: 'https://cdn.example.com/products/dusty-olive-tee-2.jpg',
    },
  ],
};

const listingUrl =
  'https://www.buckmason.com/products/dusty-olive-venice-wash-slub-curved-hem-tee';

const metadata = normalizeShopifyMetadata(sampleProduct, listingUrl);

console.log('Normalized Shopify metadata sample:', metadata);

if (metadata.listingUrl !== listingUrl) {
  throw new Error('Listing URL was not preserved');
}

if (metadata.image !== sampleProduct.images[0].src) {
  throw new Error('Primary image mismatch');
}

if (!metadata.tags || metadata.tags.length !== 4) {
  throw new Error('Tags were not parsed correctly');
}

console.log('Shopify metadata normalization test passed ✅');
