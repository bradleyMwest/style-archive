import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { load, CheerioAPI } from 'cheerio';
import { isLikelyShopifyProductUrl, normalizeShopifyMetadata, type ShopifyProduct } from '../../lib/shopify';
import { fetchShopifyProduct } from '../../lib/shopify-fetch';

const IMAGE_ATTRS = ['data-src', 'data-original', 'data-image', 'data-lazy-src', 'data-hi-res-src', 'src'];
const SRCSET_ATTRS = ['data-srcset', 'data-src-set', 'srcset'];
const MAX_SCRAPED_IMAGES = 12;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
} as const;

const normalizeAssetUrl = (rawValue: string | undefined | null, baseUrl: string): string | null => {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch (error) {
    console.warn('Unable to normalize image URL', rawValue, error);
    return null;
  }
};

const collectImageUrls = ($: CheerioAPI, baseUrl: string): string[] => {
  const results: string[] = [];
  const addCandidate = (candidate: string | null) => {
    if (candidate && !results.includes(candidate)) {
      results.push(candidate);
    }
  };

  $('img').each((_, img) => {
    const element = $(img);

    SRCSET_ATTRS.forEach((attr) => {
      const attrValue = element.attr(attr);
      if (!attrValue) return;
      attrValue
        .split(',')
        .map((entry) => entry.trim().split(' ')[0])
        .filter(Boolean)
        .forEach((url) => addCandidate(normalizeAssetUrl(url, baseUrl)));
    });

    IMAGE_ATTRS.forEach((attr) => {
      const attrValue = element.attr(attr);
      if (!attrValue) return;
      addCandidate(normalizeAssetUrl(attrValue, baseUrl));
    });
  });

  return results.slice(0, MAX_SCRAPED_IMAGES);
};

const fetchListingHtml = async (url: string): Promise<string> => {
  let cookieHeader = '';
  try {
    const sessionResp = await fetch('https://www.mrporter.com/', {
      headers: {
        ...BROWSER_HEADERS,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });

    if (sessionResp.ok) {
      type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };
      const enhancedHeaders = sessionResp.headers as HeadersWithSetCookie;
      const legacyCookie = sessionResp.headers.get('set-cookie');
      const rawCookies = enhancedHeaders.getSetCookie?.() ?? (legacyCookie ? [legacyCookie] : []);
      if (rawCookies && rawCookies.length > 0) {
        cookieHeader = rawCookies.map((cookie: string) => cookie.split(';')[0]).join('; ');
      }
    } else {
      console.warn('Failed to bootstrap Mr Porter session', sessionResp.status);
    }
  } catch (sessionError) {
    console.warn('Error creating Mr Porter session', sessionError);
  }

  const pageResp = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: 'https://www.mrporter.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });

  if (!pageResp.ok) {
    throw new Error(`Listing request failed with status ${pageResp.status}`);
  }

  return pageResp.text();
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { input, type } = await request.json(); // type: 'url', 'listing', or 'description'

    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    const normalizedInput = typeof input === 'string' ? input.trim() : '';

    if (!normalizedInput) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    let prompt = '';
    let scrapedImages: string[] = [];
    let listingUrlFromInput: string | undefined;

    const baseImagePrompt = (url: string) => `Analyze this clothing item image and extract the following metadata.
Return a JSON object ONLY, with these keys: type, color, size, tags, name, material, brand.
Do not add any explanatory text.

Example:
{
  "type": "jacket",
  "color": "blue",
  "size": "M",
  "tags": ["casual","street"],
  "name": "Blue Denim Jacket",
  "material": "cotton",
  "brand": "Levi's"
}

Image URL: ${url}`;

    const composeDescriptionPrompt = (description: string) => `Analyze this clothing item description and extract the following metadata.
Return a JSON object ONLY, with these keys: type, color, size, tags, name, material, brand.
Do not add any explanatory text.

Example:
{
  "type": "jacket",
  "color": "blue",
  "size": "M",
  "tags": ["casual","street"],
  "name": "Blue Denim Jacket",
  "material": "cotton",
  "brand": "Levi's"
}

Description: "${description}"`;

    const buildListingDetails = async (url: string) => {
      try {
        const html = await fetchListingHtml(url);
        const $ = load(html);
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
        const desc =
          $('meta[property="og:description"]').attr('content') ||
          $('meta[name="description"]').attr('content') ||
          '';

        let listingImages = collectImageUrls($, url);
        const metaImage = normalizeAssetUrl(
          $('meta[property="og:image"]').attr('content') ||
            $('meta[name="og:image"]').attr('content') ||
            $('img').first().attr('src'),
          url
        );

        if (metaImage) {
          listingImages = [metaImage, ...listingImages];
        }

        listingImages = Array.from(new Set(listingImages.filter(Boolean)));
        const heroImage = listingImages[0] || '';
        let productInfo = `Title: ${title}\nDescription: ${desc}\nImage URL: ${heroImage}`;
        if (listingImages.length > 0) {
          productInfo += `\nAll Images: ${listingImages.slice(0, 10).join(', ')}`;
        }
        if (!title && !desc && !heroImage) {
          productInfo = `URL: ${url}\n(No structured metadata was extracted from the page due to fetch restrictions)`;
        }

        return { productInfo, listingImages };
      } catch (error) {
        console.warn('Unable to scrape listing URL, falling back to URL-only prompt', error);
        return {
          productInfo: `URL: ${url}\n(No structured metadata could be retrieved. Infer details from the URL structure.)`,
          listingImages: [],
        };
      }
    };

    const buildListingPrompt = async (url: string) => {
      const { productInfo, listingImages } = await buildListingDetails(url);
      scrapedImages = listingImages;
      return `This is a product listing URL. Extract clothing metadata (type, color, size, tags, name, material, brand) from the listing details. Use the fields below as a starting point. If they are missing, make the best inference from the URL and general product naming.

${productInfo}

Return a JSON object ONLY with keys: type, color, size, tags, name, material, brand, listingUrl. The listingUrl must echo the product URL. Do not add any extra narrative text.`;
    };

    if (type === 'url' || type === 'listing') {
      const url = normalizedInput;
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
      const isDirectImage = imageExtensions.some((ext) => url.toLowerCase().endsWith(ext));

      if (isDirectImage) {
        prompt = baseImagePrompt(url);
      } else {
        listingUrlFromInput = url;

        if (isLikelyShopifyProductUrl(url)) {
          try {
            const shopifyProduct: ShopifyProduct = await fetchShopifyProduct(url);
            const shopifyMetadata = normalizeShopifyMetadata(shopifyProduct, url);
            return NextResponse.json(shopifyMetadata);
          } catch (shopifyError) {
            console.warn('Unable to fetch Shopify JSON, falling back to AI prompt', shopifyError);
          }
        }

        try {
          prompt = await buildListingPrompt(url);
        } catch (scrapeError) {
          console.warn('Unable to scrape listing URL, falling back to direct URL analysis', scrapeError);
          prompt = baseImagePrompt(url);
        }
      }
    } else {
      prompt = composeDescriptionPrompt(normalizedInput);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    let responseText = completion.choices[0]?.message?.content || '';

    if (!responseText) {
      return NextResponse.json({ error: 'Failed to analyze item' }, { status: 500 });
    }

    // Remove markdown code fences if present
    responseText = responseText.trim();
    if (responseText.startsWith('```') && responseText.endsWith('```')) {
      responseText = responseText.slice(3, -3).trim();
    }

    // Remove optional leading tokens (e.g., "json", "JSON")
    if (/^(json\s*)/i.test(responseText)) {
      responseText = responseText.replace(/^(json\s*)/i, '').trim();
    }

    console.log('analyze-item AI response:', responseText);

    type AiMetadata = {
      [key: string]: string | string[] | undefined;
      images?: string[];
      image?: string;
      listingUrl?: string;
    };

    const enrichMetadata = (metadata: AiMetadata) => {
      const result: AiMetadata = { ...metadata };

      const normalizedScraped = scrapedImages
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url) => url.length > 0);

      if (normalizedScraped.length > 0) {
        const existingImages = Array.isArray(result.images)
          ? result.images
              .map((url) => (typeof url === 'string' ? url.trim() : ''))
              .filter((url): url is string => url.length > 0)
          : [];
        result.images = Array.from(new Set([...normalizedScraped, ...existingImages]));
      }

      if (!result.image && Array.isArray(result.images) && result.images.length > 0) {
        result.image = result.images[0];
      }

      if (listingUrlFromInput && !result.listingUrl) {
        result.listingUrl = listingUrlFromInput;
      }

      return result;
    };

    // Try to parse the JSON response
    try {
      const metadata = JSON.parse(responseText) as AiMetadata;
      return NextResponse.json(enrichMetadata(metadata));
    } catch {
      // If JSON parsing fails, try to extract structured data from text
      const lines = responseText.split('\n');
      const metadata: AiMetadata = {};

      lines.forEach((line: string) => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          const cleanKey = key.toLowerCase().trim();
          if (cleanKey === 'type') metadata.type = value;
          else if (cleanKey === 'color') metadata.color = value;
          else if (cleanKey === 'size') metadata.size = value;
          else if (cleanKey === 'tags') metadata.tags = value.split(',').map((tag: string) => tag.trim());
          else if (cleanKey === 'name') metadata.name = value;
          else if (cleanKey === 'material') metadata.material = value;
          else if (cleanKey === 'brand') metadata.brand = value;
        }
      });

      return NextResponse.json(enrichMetadata(metadata));
    }
  } catch (error) {
    console.error('Error analyzing item:', error);
    return NextResponse.json({ error: 'Failed to analyze item' }, { status: 500 });
  }
}
