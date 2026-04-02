import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const MODEL = process.env.OUTFIT_SUGGESTION_MODEL || 'gpt-4o-mini';

export async function POST() {
  try {
    const items = await prisma.item.findMany({
      orderBy: { dateAdded: 'desc' },
      take: 30,
    });

    if (!openai) {
      return NextResponse.json({ error: 'LLM not configured' }, { status: 500 });
    }

    if (items.length < 2) {
      return NextResponse.json({ suggestions: [], warning: 'Need at least two items to build outfits.' });
    }

    const inventorySummary = items
      .map(
        (item) =>
          `ID: ${item.id}\nName: ${item.name}\nType: ${item.type}\nColor: ${item.color}\nSize: ${item.size}\nMaterial: ${item.material ?? 'Unknown'}\nTags: ${item.tags}\n`
      )
      .join('\n');

    const prompt = `You are a wardrobe stylist. Using the inventory items below, suggest up to 3 cohesive outfits. Each outfit should include 2-4 items that complement each other. Prefer mixing tops, bottoms, outerwear, and shoes when available. For each outfit, provide a short name, list of item IDs included, a concise description, and 1-2 sentences explaining why the pieces work together. Respond ONLY with valid JSON formatted as an array of objects with keys: name (string), itemIds (array of item IDs), description (string), reasoning (string).\n\nInventory:\n${inventorySummary}`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    if (!rawContent) {
      return NextResponse.json({ error: 'Empty LLM response' }, { status: 500 });
    }

    const extractJson = (input: string) => {
      const fenceMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        return fenceMatch[1].trim();
      }
      return input;
    };

    const content = extractJson(rawContent);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.warn('Unable to parse LLM JSON', content, error);
      return NextResponse.json({ error: 'Failed to parse LLM output' }, { status: 500 });
    }

    const suggestions = Array.isArray(parsed)
      ? parsed
          .map((entry) => {
            const itemIds = Array.isArray(entry.itemIds)
              ? Array.from(
                  new Set(entry.itemIds.filter((id: unknown): id is string => typeof id === 'string'))
                )
              : [];
            if (itemIds.length === 0) return null;
            const normalizedIds = [...itemIds].sort();
            return {
              name: typeof entry.name === 'string' ? entry.name : 'Untitled Outfit',
              description: typeof entry.description === 'string' ? entry.description : '',
              reasoning: typeof entry.reasoning === 'string' ? entry.reasoning : '',
              itemIds: itemIds,
              itemHash: normalizedIds.join('|'),
            };
          })
          .filter((entry): entry is { name: string; description: string; reasoning: string; itemIds: string[]; itemHash: string } => Boolean(entry))
      : [];

    if (suggestions.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, newSuggestions: [] });
    }

    const existing = await prisma.outfitSuggestion.findMany({
      where: { itemHash: { in: suggestions.map((entry) => entry.itemHash) } },
    });
    const existingHashes = new Set(existing.map((entry) => entry.itemHash));

    const creations = suggestions.filter((entry) => !existingHashes.has(entry.itemHash));

    const createdRecords =
      creations.length > 0
        ? await prisma.$transaction(
            creations.map((entry) =>
              prisma.outfitSuggestion.create({
                data: {
                  name: entry.name,
                  description: entry.description,
                  reasoning: entry.reasoning,
                  itemIds: JSON.stringify(entry.itemIds),
                  itemHash: entry.itemHash,
                },
              })
            )
          )
        : [];

    return NextResponse.json({
      created: createdRecords.length,
      skipped: suggestions.length - creations.length,
      newSuggestions: createdRecords.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description ?? '',
        reasoning: record.reasoning ?? '',
        itemIds: (() => {
          try {
            const parsedIds = JSON.parse(record.itemIds);
            return Array.isArray(parsedIds)
              ? parsedIds.filter((id: unknown): id is string => typeof id === 'string')
              : [];
          } catch {
            return [];
          }
        })(),
        status: record.status as 'liked' | 'try' | 'nope',
      })),
    });
  } catch (error) {
    console.error('Error generating outfit suggestions', error);
    return NextResponse.json({ error: 'Failed to generate outfit suggestions' }, { status: 500 });
  }
}
