import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type RecordProductUrlArgs = {
  url?: string | null;
  userId?: string;
  source?: string;
  extra?: Prisma.JsonValue;
};

const normalizeUrlValue = (value?: string | null) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    const pathname =
      parsed.pathname.replace(/\/+$/, '').length > 0
        ? parsed.pathname.replace(/\/+$/, '')
        : '/';
    const search = parsed.search ?? '';
    const canonical = `${parsed.protocol}//${parsed.host}${pathname}${search}`;
    return {
      canonical,
      domain: parsed.hostname.toLowerCase(),
      normalizedPath: `${parsed.hostname.toLowerCase()}${pathname}`,
    };
  } catch {
    return null;
  }
};

export const recordProductUrl = async ({
  url,
  userId,
  source,
  extra,
}: RecordProductUrlArgs) => {
  if (!url) return;
  const normalized = normalizeUrlValue(url);
  if (!normalized) return;

  try {
    await prisma.productUrl.upsert({
      where: { url: normalized.canonical },
      create: {
        url: normalized.canonical,
        normalizedUrl: normalized.normalizedPath,
        domain: normalized.domain,
        source: source ?? null,
        userId: userId ?? null,
        extra: extra ?? null,
      },
      update: {
        normalizedUrl: normalized.normalizedPath,
        domain: normalized.domain,
        source: source ?? undefined,
        userId: userId ?? undefined,
        extra: extra ?? undefined,
      },
    });
  } catch (error) {
    console.warn('recordProductUrl failed', normalized.canonical, error);
  }
};
