import './load-env';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../app/lib/prisma';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'backups');

const jsonReplacer = (_key: string, value: unknown) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  return value;
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(OUTPUT_DIR, `backup-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    items: await prisma.item.findMany(),
    outfits: await prisma.outfit.findMany(),
    outfitSuggestions: await prisma.outfitSuggestion.findMany(),
    candidateItems: await prisma.candidateItem.findMany({ include: { evaluation: true } }),
    retailProducts: await prisma.retailProduct.findMany(),
    productUrls: await prisma.productUrl.findMany(),
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, jsonReplacer, 2));
  console.log(`Database backup written to ${filePath}`);
}

main()
  .catch((error) => {
    console.error('Backup failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
