import { NextRequest, NextResponse } from 'next/server';
import { importProductFromUrl } from '../../lib/importer/import-product';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { url, preferPlaywright } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const product = await importProductFromUrl(url, {
      preferPlaywright: Boolean(preferPlaywright),
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Product import failed', error);
    return NextResponse.json({ error: 'Failed to import product URL' }, { status: 500 });
  }
}
