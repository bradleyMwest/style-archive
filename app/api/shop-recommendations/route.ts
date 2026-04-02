import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';
import { getRequestUser } from '../../lib/api-auth';
import { searchRakutenProducts, type RakutenProduct } from '../../lib/rakuten';

export const runtime = 'nodejs';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const MODEL = process.env.SHOP_RECOMMENDER_MODEL || 'gpt-4o-mini';

type ComplementaryQuery = {
  baseItemId: string;
  complementaryCategory: string;
  searchQuery: string;
  reasoning: string;
  priceExpectation: string;
};

type Suggestion = {
  baseItem: {
    id: string;
    name: string;
    color: string;
    image: string | null;
  };
  complementaryCategory: string;
  searchQuery: string;
  reasoning: string;
  priceExpectation: string;
  products: RakutenProduct[];
};

const formatStyleProfile = (profile?: {
  selfDescription: string | null;
  styleGoals: string | null;
  lifestyleNotes: string | null;
  fitNotes: string | null;
  preferredBrands: string | null;
  favoriteColors: string | null;
  budgetFocus: string | null;
  ageRange: string | null;
  location: string | null;
  climate: string | null;
  aiSummary: string | null;
  aiKeywords: string | null;
} | null) => {
  if (!profile) return 'User has not filled out their style profile yet.';
  const parts = [
    profile.aiSummary,
    profile.selfDescription,
    profile.styleGoals ? `Goals: ${profile.styleGoals}` : null,
    profile.lifestyleNotes ? `Lifestyle: ${profile.lifestyleNotes}` : null,
    profile.fitNotes ? `Fit notes: ${profile.fitNotes}` : null,
    profile.preferredBrands ? `Fav brands: ${profile.preferredBrands}` : null,
    profile.favoriteColors ? `Colors: ${profile.favoriteColors}` : null,
    profile.budgetFocus ? `Budget focus: ${profile.budgetFocus}` : null,
    profile.ageRange ? `Age range: ${profile.ageRange}` : null,
    profile.location ? `Location: ${profile.location}` : null,
    profile.climate ? `Climate: ${profile.climate}` : null,
    profile.aiKeywords ? `Keywords: ${profile.aiKeywords}` : null,
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  return parts.join('\n');
};

const DUMMY_SUGGESTIONS: Suggestion[] = [];

const extractJson = (raw: string) => {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : raw;
};

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [items, styleProfile] = await Promise.all([
      prisma.item.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, type: true, color: true, brand: true, image: true },
        orderBy: { dateAdded: 'desc' },
        take: 40,
      }),
      prisma.styleProfile.findUnique({ where: { userId: user.id } }),
    ]);

    if (!openai || items.length === 0) {
      return NextResponse.json({
        suggestions: DUMMY_SUGGESTIONS,
        source: 'fallback',
        profileUsed: Boolean(styleProfile),
        profileSummary: styleProfile?.aiSummary ?? null,
      });
    }

    const profileContext = formatStyleProfile(styleProfile);
    const prompt = `You are a wardrobe stylist who pairs existing closet pieces with new complementary items found online.

Inventory Items (include id field in responses):
${items
  .map((item) => `- ${item.id}: ${item.name} (${item.type}) in ${item.color}${item.brand ? ` by ${item.brand}` : ''}`)
  .join('\n')}

Style Profile:
${profileContext}

Select up to 4 base items (choose by id) that would benefit from a complementary purchase. For each selected item, return an object with:
- "baseItemId": string id from the list above
- "complementaryCategory": short label of what to buy (e.g., "Weatherproof boots")
- "searchQuery": concise keyword string for a shopping API (no punctuation besides spaces)
- "reasoning": one sentence explaining the pairing
- "priceExpectation": e.g., "$120-$200 leather boots"

Respond ONLY with valid JSON array (no markdown).`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
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

    const plannedQueries: ComplementaryQuery[] = Array.isArray(parsed)
      ? parsed
          .map((entry): ComplementaryQuery | null => {
            if (!entry || typeof entry !== 'object') return null;
            const record = entry as Record<string, unknown>;
            const baseItemId = typeof record.baseItemId === 'string' ? record.baseItemId : null;
            if (!baseItemId) return null;
            const complementaryCategory =
              typeof record.complementaryCategory === 'string'
                ? record.complementaryCategory
                : 'Complementary piece';
            const searchQuery = typeof record.searchQuery === 'string' ? record.searchQuery : '';
            if (!searchQuery) return null;
            const reasoning =
              typeof record.reasoning === 'string' ? record.reasoning : 'Pairs well with current wardrobe.';
            const priceExpectation =
              typeof record.priceExpectation === 'string' ? record.priceExpectation : 'Typical price varies.';
            return {
              baseItemId,
              complementaryCategory,
              searchQuery,
              reasoning,
              priceExpectation,
            };
          })
          .filter((entry): entry is ComplementaryQuery => Boolean(entry))
          .slice(0, 4)
      : [];

    if (plannedQueries.length === 0) {
      return NextResponse.json({ suggestions: DUMMY_SUGGESTIONS, source: 'fallback' });
    }

    const suggestionsWithProducts = await Promise.all(
      plannedQueries.map(async (planned) => {
        const baseItem = items.find((item) => item.id === planned.baseItemId);
        if (!baseItem) return null;
        const products = await searchRakutenProducts(planned.searchQuery, { limit: 4 });
        const normalizedImage: string | null =
          typeof baseItem.image === 'string' && baseItem.image.length > 0 ? baseItem.image : null;
        return {
          baseItem: {
            id: baseItem.id,
            name: baseItem.name,
            color: baseItem.color,
            image: normalizedImage,
          },
          complementaryCategory: planned.complementaryCategory,
          searchQuery: planned.searchQuery,
          reasoning: planned.reasoning,
          priceExpectation: planned.priceExpectation,
          products,
        };
      })
    );

    const filteredSuggestions = suggestionsWithProducts.filter((entry): entry is Suggestion => Boolean(entry));

    return NextResponse.json({
      suggestions: filteredSuggestions,
      source: 'rakuten',
      profileUsed: Boolean(styleProfile),
      profileSummary: styleProfile?.aiSummary ?? null,
    });
  } catch (error) {
    console.error('Failed to generate shop recommendations', error);
    return NextResponse.json({
      suggestions: DUMMY_SUGGESTIONS,
      source: 'fallback',
      profileUsed: false,
      profileSummary: null,
    });
  }
}
