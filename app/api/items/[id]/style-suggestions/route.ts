import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../lib/prisma';
import { getRequestUser } from '../../../../lib/api-auth';

export const runtime = 'nodejs';

const MODEL = process.env.ITEM_STYLE_MODEL || 'gpt-4o-mini';
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const MAX_CONTEXT_ITEMS = 20;

const formatInventorySummary = (
  items: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    size: string;
    brand: string | null;
    material: string | null;
    tags: string;
  }>
) =>
  items
    .map(
      (item) =>
        `ID: ${item.id}\nName: ${item.name}\nType: ${item.type}\nColor: ${item.color}\nSize: ${item.size}\nBrand: ${item.brand ?? 'Unknown'}\nMaterial: ${item.material ?? 'Unknown'}\nTags: ${
          item.tags || 'None'
        }\n`
    )
    .join('\n');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!openai) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 500 });
  }

  const { id } = await params;

  const [item, inventory] = await Promise.all([
    prisma.item.findFirst({
      where: { id, userId: user.id },
    }),
    prisma.item.findMany({
      where: { userId: user.id },
      orderBy: { dateAdded: 'desc' },
      take: MAX_CONTEXT_ITEMS,
    }),
  ]);

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (inventory.length === 0) {
    return NextResponse.json({ error: 'No inventory available for suggestions' }, { status: 400 });
  }
  const inventoryLookup = new Map(inventory.map((entry) => [entry.id, { id: entry.id, name: entry.name }]));

  const targetSummary = `Name: ${item.name}
Type: ${item.type}
Color: ${item.color}
Size: ${item.size}
Brand: ${item.brand ?? 'Unknown'}
Material: ${item.material ?? 'Unknown'}
Tags: ${item.tags || 'None'}
Description: ${item.description ?? 'N/A'}`;

  const inventorySummary = formatInventorySummary(inventory);

  const prompt = `You are a personal stylist. Provide 3 creative styling suggestions for the highlighted wardrobe item.

For each suggestion include:
- "title": catchy name
- "summary": 1-2 sentence description of the look
- "recommendedItems": array of inventory item IDs that would pair nicely (USE ONLY IDs present below when suggesting existing pieces; omit if you truly can't find a match)
- "tips": concise styling tip or accessory recommendation

Use the user's existing inventory whenever possible. It's better to reuse their items than invent new garments. Respond ONLY with valid JSON array of suggestion objects.

Target Item:
${targetSummary}

Inventory:
${inventorySummary}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'Empty response from stylist model' }, { status: 500 });
    }

    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonPayload = fenceMatch ? fenceMatch[1].trim() : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch (error) {
      console.warn('Failed to parse style suggestion JSON', jsonPayload, error);
      return NextResponse.json({ error: 'Invalid stylist response' }, { status: 500 });
    }

    type RawSuggestion = {
      title: string;
      summary: string;
      tips: string;
      recommendedItems: string[];
    };

    const suggestions: RawSuggestion[] = Array.isArray(parsed)
      ? parsed
          .map((entry: unknown) => {
            if (typeof entry !== 'object' || entry === null) {
              return null;
            }
            const candidate = entry as Record<string, unknown>;
            const recommended = Array.isArray(candidate.recommendedItems)
              ? candidate.recommendedItems.filter((id: unknown): id is string => typeof id === 'string')
              : [];
            return {
              title: typeof candidate.title === 'string' ? candidate.title : 'Styling Idea',
              summary: typeof candidate.summary === 'string' ? candidate.summary : '',
              tips: typeof candidate.tips === 'string' ? candidate.tips : '',
              recommendedItems: recommended,
            };
          })
          .filter((entry): entry is RawSuggestion => {
            if (!entry) return false;
            return entry.summary.length > 0 || entry.tips.length > 0 || entry.recommendedItems.length > 0;
          })
      : [];

    const enriched = suggestions.map((entry) => ({
      ...entry,
      recommendedItems: entry.recommendedItems
        .filter((id) => inventoryLookup.has(id))
        .map((id) => inventoryLookup.get(id)!),
    }));

    return NextResponse.json({ suggestions: enriched });
  } catch (error) {
    console.error('Failed to create styling suggestions', error);
    return NextResponse.json({ error: 'Unable to generate styling suggestions' }, { status: 500 });
  }
}
