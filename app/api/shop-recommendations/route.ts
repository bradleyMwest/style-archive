import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const MODEL = process.env.SHOP_RECOMMENDER_MODEL || 'gpt-4o-mini';

type Suggestion = {
  category: string;
  description: string;
  searchQueries: string[];
  suggestedBrands: string[];
  priceAnchors: string;
  reason: string;
};

const BRAND_CATALOG = [
  {
    name: 'Taylor Stitch',
    url: 'https://www.taylorstitch.com/search?type=product&q=',
    tags: ['workwear', 'overshirt', 'rugged'],
  },
  {
    name: 'Quince',
    url: 'https://www.quince.com/search?query=',
    tags: ['essentials', 'cashmere', 'silk'],
  },
  {
    name: 'Everlane',
    url: 'https://www.everlane.com/search?q=',
    tags: ['minimal', 'denim', 'outerwear'],
  },
  {
    name: 'Greats',
    url: 'https://www.greats.com/search?q=',
    tags: ['sneakers', 'leather'],
  },
] as const;

const DUMMY_SUGGESTIONS: Suggestion[] = [
  {
    category: 'Overshirt Layer',
    description: 'Mid-weight cotton or denim overshirt that can layer over tees and flannels.',
    searchQueries: ['selvedge overshirt', 'indigo chore shirt'],
    suggestedBrands: ['Taylor Stitch', 'Quince'],
    priceAnchors: '$120-$160',
    reason: 'Your wardrobe leans denim/casual; a rugged overshirt adds depth without clashing.',
  },
  {
    category: 'Minimal Leather Sneakers',
    description: 'Neutral court-inspired sneakers with low profile and leather upper.',
    searchQueries: ['minimal white sneaker', 'off-white leather trainer'],
    suggestedBrands: ['Greats', 'Everlane'],
    priceAnchors: '$100-$150',
    reason: 'Contrast nicely with your darker denim and match the muted palette you own.',
  },
];

const summarizeInventory = (items: { id: string; name: string; type: string; color: string; brand: string | null }[]) =>
  items
    .map(
      (item) =>
        `${item.name} (${item.type}) in ${item.color}${item.brand ? ` by ${item.brand}` : ''}`
    )
    .join('\n');

const extractJson = (raw: string) => {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : raw;
};

export async function POST() {
  try {
    const items = await prisma.item.findMany({
      select: { id: true, name: true, type: true, color: true, brand: true },
      orderBy: { dateAdded: 'desc' },
      take: 40,
    });

    if (!openai || items.length === 0) {
      return NextResponse.json({ suggestions: DUMMY_SUGGESTIONS, source: 'fallback' });
    }

    const catalogSummary = BRAND_CATALOG.map(
      (brand) => `${brand.name}: ${brand.tags.join(', ')}`
    ).join('\n');

    const prompt = `You are a personal shopper. Given the wardrobe inventory below, suggest up to 4 categories of items to add. For each suggestion provide: category, description, up to 3 product search queries (strings a user can paste into brand sites), 2 suggested brand names chosen from this catalog (only use brands listed), price range guidance, and a short reason referencing the wardrobe.\n\nBrand Catalog:\n${catalogSummary}\n\nInventory:\n${summarizeInventory(items)}\n\nRespond ONLY with valid JSON: array of objects with keys category, description, searchQueries (array of strings), suggestedBrands (array of catalog brand names), priceAnchors, reason. No URLs.`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ suggestions: DUMMY_SUGGESTIONS, source: 'fallback' });
    }

    const content = extractJson(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.warn('Unable to parse shop LLM response', content, error);
      return NextResponse.json({ suggestions: DUMMY_SUGGESTIONS, source: 'fallback' });
    }

    const suggestions: Suggestion[] = Array.isArray(parsed)
      ? parsed
          .map((entry) => ({
            category: typeof entry.category === 'string' ? entry.category : 'Suggested piece',
            description: typeof entry.description === 'string' ? entry.description : '',
            searchQueries: Array.isArray(entry.searchQueries)
              ? entry.searchQueries.filter((q: unknown): q is string => typeof q === 'string')
              : [],
            suggestedBrands: Array.isArray(entry.suggestedBrands)
              ? entry.suggestedBrands
                  .filter((name: unknown): name is string => typeof name === 'string')
                  .filter((name) => BRAND_CATALOG.some((brand) => brand.name === name))
              : [],
            priceAnchors: typeof entry.priceAnchors === 'string' ? entry.priceAnchors : '$100-$200',
            reason: typeof entry.reason === 'string' ? entry.reason : 'Complements your wardrobe.',
          }))
          .filter((entry) => entry.searchQueries.length > 0 || entry.description)
          .slice(0, 6)
      : DUMMY_SUGGESTIONS;

    return NextResponse.json({ suggestions, source: 'llm' });
  } catch (error) {
    console.error('Failed to generate shop recommendations', error);
    return NextResponse.json({ suggestions: DUMMY_SUGGESTIONS, source: 'fallback' });
  }
}
