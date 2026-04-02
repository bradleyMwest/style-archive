import { NextRequest, NextResponse } from 'next/server';
import { importProductFromUrl } from '../../lib/importer/import-product';
import { getRequestUser } from '../../lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
