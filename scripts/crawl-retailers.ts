import './load-env';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { Prisma } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { load as loadHtml } from 'cheerio';

import { prisma } from '../app/lib/prisma';
import { importProductFromUrl } from '../app/lib/importer/import-product';
import { renderWithPlaywright } from '../app/lib/importer/playwright';

const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
} as const;
const BLOCK_PATTERNS = [/Just a moment/i, /Cloudflare/i, /Access Denied/i];
const DEFAULT_CONCURRENCY = Number(process.env.RETAILER_CRAWL_CONCURRENCY ?? '3');
const CPU_MONITOR_INTERVAL_MS = Number(process.env.RETAILER_CPU_MONITOR_MS ?? '15000');
const xmlParser = new XMLParser({ ignoreAttributes: false });

type MonitorContext = {
  retailer: string;
  processed: number;
  total: number;
};

let monitorContext: MonitorContext = { retailer: 'idle', processed: 0, total: 0 };

const updateMonitorContext = (patch: Partial<MonitorContext>) => {
  monitorContext = { ...monitorContext, ...patch };
};

const incrementMonitorProcessed = () => {
  if (monitorContext.total === 0) return;
  const next = Math.min(monitorContext.processed + 1, monitorContext.total);
  monitorContext = { ...monitorContext, processed: next };
};

const startSystemMonitor = () => {
  if (CPU_MONITOR_INTERVAL_MS <= 0) {
    return () => {};
  }
  const logStats = () => {
    const [one, five] = os.loadavg();
    const memUsage = 1 - os.freemem() / os.totalmem();
    const { retailer, processed, total } = monitorContext;
    const progress = total > 0 ? `${processed}/${total}` : 'idle';
    console.log(
      `[system] load1=${one.toFixed(2)} load5=${five.toFixed(2)} mem=${(memUsage * 100).toFixed(1)}% current=${retailer} (${progress})`
    );
  };
  logStats();
  const interval = setInterval(logStats, CPU_MONITOR_INTERVAL_MS);
  return () => clearInterval(interval);
};

type RetailerConfig = {
  name: string;
  urls?: string[];
  sitemaps?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  limit?: number;
};

type RetailerFile = {
  retailers: RetailerConfig[];
};

const loadRetailerConfig = (): RetailerConfig[] => {
  const configPath = path.resolve(__dirname, '../data/retailers.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Retailer config not found at ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as RetailerFile;
  return parsed.retailers ?? [];
};

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const cleanup = (value: string | undefined | null) => (value ? value.trim() : undefined);

const dedupeUrls = (urls: string[]) => {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  return list;
};

const looksBlocked = (payload: string) => BLOCK_PATTERNS.some((pattern) => pattern.test(payload));

const extractXmlFromHtml = (html: string) => {
  const $ = loadHtml(html);
  const preText = $('pre').text().trim();
  if (preText.startsWith('<?xml')) {
    return preText;
  }
  const codeText = $('code').text().trim();
  if (codeText.startsWith('<?xml')) {
    return codeText;
  }
  const idx = html.indexOf('<?xml');
  if (idx !== -1) {
    return html.slice(idx);
  }
  return html;
};

const fetchTextWithFallback = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, {
      headers: HTTP_HEADERS,
      redirect: 'follow',
    });
    const text = await response.text();
    if (response.ok && text.trim().length > 0 && !looksBlocked(text)) {
      return text;
    }
    console.warn(`Primary sitemap fetch failed (${response.status}) for ${url}`);
  } catch (error) {
    console.warn(`Primary sitemap fetch error for ${url}`, error);
  }

  const rendered = await renderWithPlaywright(url, 45000);
  if (rendered?.html) {
    return extractXmlFromHtml(rendered.html);
  }
  throw new Error(`Unable to load sitemap ${url}`);
};

const collectSitemapUrls = async (sitemapUrl: string, visited = new Set<string>()): Promise<string[]> => {
  if (visited.has(sitemapUrl)) {
    return [];
  }
  visited.add(sitemapUrl);
  const xml = await fetchTextWithFallback(sitemapUrl);
  const parsed = xmlParser.parse(xml);

  if (parsed.sitemapindex) {
    const entries = toArray(parsed.sitemapindex.sitemap);
    const nested = await Promise.all(
      entries.map(async (entry: { loc?: string }) => {
        const loc = cleanup(entry?.loc);
        if (!loc) return [];
        return collectSitemapUrls(loc, visited);
      })
    );
    return nested.flat();
  }

  if (parsed.urlset) {
    const urls = toArray(parsed.urlset.url);
    return urls
      .map((entry: { loc?: string }) => cleanup(entry?.loc))
      .filter((loc): loc is string => typeof loc === 'string');
  }

  console.warn(`Unsupported sitemap format for ${sitemapUrl}`);
  return [];
};

const filterUrls = (urls: string[], config: RetailerConfig) => {
  const includes = config.includePatterns ?? [];
  const excludes = config.excludePatterns ?? [];
  return urls.filter((url) => {
    if (excludes.some((pattern) => url.includes(pattern))) {
      return false;
    }
    if (includes.length > 0) {
      return includes.some((pattern) => url.includes(pattern));
    }
    return true;
  });
};

const resolveTargetUrls = async (retailer: RetailerConfig): Promise<string[]> => {
  const direct = dedupeUrls(retailer.urls ?? []);
  let derived: string[] = [];
  if (retailer.sitemaps && retailer.sitemaps.length > 0) {
    const collected = await Promise.all(
      retailer.sitemaps.map(async (sitemap) => {
        try {
          return collectSitemapUrls(sitemap);
        } catch (error) {
          console.warn(`Unable to read sitemap ${sitemap}`, error);
          return [];
        }
      })
    );
    derived = collected.flat();
  }
  let merged = dedupeUrls([...direct, ...derived]);
  merged = filterUrls(merged, retailer);
  if (retailer.limit && retailer.limit > 0) {
    return merged.slice(0, retailer.limit);
  }
  return merged;
};

const toCommaSeparated = (values: string[] | undefined | null) => {
  if (!values || values.length === 0) return null;
  return values.join(',');
};

const storeProduct = async (retailer: string, url: string) => {
  const existing = await prisma.retailProduct.findUnique({ where: { listingUrl: url } });
  if (existing && Date.now() - existing.updatedAt.getTime() < RECENCY_WINDOW_MS) {
    return 'skipped';
  }

  const draft = await importProductFromUrl(url, { preferPlaywright: false, skipLlm: true });

  const title = draft.title?.trim();
  if (!title || /oops! something went wrong/i.test(title)) {
    console.warn(`Skipped ${url} (unusable title: ${title ?? 'n/a'})`);
    return 'failed';
  }

  if (!draft.title) {
    console.warn(`No title parsed for ${url}`);
  }

  const gallery = draft.images ?? [];
  const priceAmount = draft.price?.amount != null ? new Prisma.Decimal(draft.price.amount) : null;
  const metadataPayload = {
    gallery,
    tags: draft.tags ?? [],
    warnings: draft.warnings ?? [],
    sourceTrail: draft.sourceTrail ?? [],
    raw: draft.rawSections ?? {},
    scrapedAt: draft.scrapedAt,
  };

  const payload: Prisma.RetailProductUncheckedCreateInput = {
    retailer,
    listingUrl: url,
    name: draft.title ?? 'Untitled Product',
    type: draft.type ?? null,
    color: draft.color ?? null,
    sizeSummary: draft.size ?? null,
    heroImage: gallery[0] ?? null,
    gallery: gallery.length > 0 ? JSON.stringify(gallery) : null,
    description: draft.description ?? null,
    tags: toCommaSeparated(draft.tags ?? []),
    material: draft.material ?? null,
    brand: draft.brand ?? null,
    priceAmount,
    priceCurrency: draft.price?.currency ?? null,
    metadata: metadataPayload as unknown as Prisma.InputJsonValue,
    reviews: Prisma.JsonNull,
  };

  try {
    if (existing) {
      await prisma.retailProduct.update({ where: { id: existing.id }, data: payload });
      return 'updated';
    }

    await prisma.retailProduct.create({ data: payload });
    return 'created';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.warn(`Duplicate listing detected, skipping ${url}`);
      return 'skipped';
    }
    throw error;
  }
};

async function main() {
  const stopMonitor = startSystemMonitor();
  try {
  const config = loadRetailerConfig();
  if (config.length === 0) {
    console.log('No retailers configured. Edit data/retailers.json to add URLs.');
    return;
  }

  const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const retailer of config) {
    let targets: string[] = [];
    try {
      targets = await resolveTargetUrls(retailer);
    } catch (error) {
      console.error(`Unable to resolve URLs for ${retailer.name}`, error);
      continue;
    }

    if (targets.length === 0) {
      console.log(`\n=== ${retailer.name} (0 urls) ===`);
      console.log('No URLs configured. Update data/retailers.json to add targets.');
      continue;
    }

    console.log(`\n=== ${retailer.name} (${targets.length} urls) ===`);
    let cursor = 0;
    const workerTotal = Math.max(1, Math.min(DEFAULT_CONCURRENCY, targets.length));
    updateMonitorContext({ retailer: retailer.name, processed: 0, total: targets.length });
    const workers = Array.from({ length: workerTotal }, () =>
      (async () => {
        while (true) {
          const position = cursor;
          cursor += 1;
          if (position >= targets.length) {
            break;
          }
          const targetUrl = targets[position];
          if (!targetUrl) continue;
          try {
            const result = await storeProduct(retailer.name, targetUrl.trim());
            stats[result as keyof typeof stats] += 1;
            console.log(`[${position + 1}/${targets.length}] ${result.toUpperCase()} ${targetUrl}`);
            incrementMonitorProcessed();
          } catch (error) {
            stats.failed += 1;
            console.error(`[${position + 1}/${targets.length}] Failed ${targetUrl}`, error);
            incrementMonitorProcessed();
          }
        }
      })()
    );

    await Promise.all(workers);
    updateMonitorContext({ retailer: 'idle', processed: 0, total: 0 });
  }

  console.log('\nRetail crawl complete:', stats);
  } finally {
    stopMonitor();
  }
}

main()
  .catch((error) => {
    console.error('Retail crawl failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
