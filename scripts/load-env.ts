import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = path.resolve(__dirname, '..');

const envFiles = ['.env', '.env.local', '.env.development.local'];

for (const file of envFiles) {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    loadEnv({ path: fullPath, override: true });
  }
}

if (!process.env.DATABASE_URL) {
  const fallback = process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
  if (fallback) {
    process.env.DATABASE_URL = fallback;
  }
}
