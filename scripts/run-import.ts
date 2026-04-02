import { importProductFromUrl } from '../app/lib/importer/import-product';

const url = process.argv[2];

if (!url) {
  console.error('Usage: tsx scripts/run-import.ts <url>');
  process.exit(1);
}

(async () => {
  try {
    const draft = await importProductFromUrl(url, { preferPlaywright: false });
    console.log(JSON.stringify(draft, null, 2));
  } catch (error) {
    console.error('Import failed', error);
    process.exitCode = 1;
  }
})();
