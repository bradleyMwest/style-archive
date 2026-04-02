import { prisma } from '../app/lib/prisma';
import { downloadHeroImage, toHeroImageBytes } from '../app/lib/hero-image';

const parseImages = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch (error) {
    console.warn('Unable to parse images JSON', error);
  }
  return [];
};

const resolveCandidates = (item: { image: string; images: string | null }): string[] => {
  const candidates: string[] = [];
  if (item.image) candidates.push(item.image);
  const parsed = parseImages(item.images);
  parsed.forEach((value) => {
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  });
  return candidates;
};

async function backfill() {
  const items = await prisma.item.findMany({ where: { heroImageData: null } });
  console.log(`Found ${items.length} item(s) missing hero image data.`);

  for (const item of items) {
    const candidateUrls = resolveCandidates(item);
    if (candidateUrls.length === 0) {
      console.warn(`Skipping ${item.id}: no image candidates available.`);
      continue;
    }

    let downloaded: Awaited<ReturnType<typeof downloadHeroImage>> = null;
    for (const url of candidateUrls) {
      downloaded = await downloadHeroImage(url);
      if (downloaded) break;
    }

    if (!downloaded) {
      console.warn(`Unable to download hero image for item ${item.id}.`);
      continue;
    }

    await prisma.item.update({
      where: { id: item.id },
      data: {
        heroImageData: toHeroImageBytes(downloaded.data),
        heroImageMimeType: downloaded.mimeType,
      },
    });

    console.log(`Cached hero image for ${item.id}`);
  }
}

backfill()
  .catch((error) => {
    console.error('Backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
