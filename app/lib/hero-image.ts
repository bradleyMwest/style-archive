import { Buffer } from 'node:buffer';

const HERO_IMAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB safeguard

type DownloadResult = {
  data: Buffer;
  mimeType: string;
};

const parseDataUrl = (value: string): DownloadResult | null => {
  const match = value.match(/^data:(.+?);base64,(.+)$/i);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  try {
    const data = Buffer.from(base64Data, 'base64');
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
      return null;
    }
    return {
      data,
      mimeType: mimeType || 'application/octet-stream',
    };
  } catch (error) {
    console.warn('Failed to parse data URL image', error);
    return null;
  }
};

export const downloadHeroImage = async (source: string): Promise<DownloadResult | null> => {
  if (!source) return null;
  if (source.startsWith('data:')) {
    return parseDataUrl(source);
  }

  try {
    const response = await fetch(source, {
      headers: HERO_IMAGE_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn('Hero image fetch failed', source, response.status);
      return null;
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      console.warn('Hero image size invalid', source, buffer.length);
      return null;
    }

    return { data: buffer, mimeType };
  } catch (error) {
    console.warn('Unable to download hero image', source, error);
    return null;
  }
};

type CachedImageArgs = {
  data: Buffer | Uint8Array | null | undefined;
  mimeType?: string | null;
  fallbackUrl: string;
};

export const toHeroImageBytes = (input: Buffer | Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(input.byteLength) as Uint8Array<ArrayBuffer>;
  copy.set(input);
  return copy;
};

export const buildCachedHeroImage = ({ data, mimeType, fallbackUrl }: CachedImageArgs) => {
  if (data && (data as Buffer).length > 0) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const base64 = buffer.toString('base64');
    const normalizedMime = mimeType && mimeType.trim().length > 0 ? mimeType : 'application/octet-stream';
    return `data:${normalizedMime};base64,${base64}`;
  }
  return fallbackUrl;
};
