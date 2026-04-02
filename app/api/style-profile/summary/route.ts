import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../lib/prisma';
import { getRequestUser } from '../../../lib/api-auth';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const MODEL = process.env.STYLE_SUMMARY_MODEL || 'gpt-4o-mini';

const summarizeInventory = (
  items: { name: string; type: string; color: string; material: string | null; brand: string | null }[]
) =>
  items
    .map((item) => {
      const descriptors = [item.color, item.material, item.brand].filter(Boolean).join(', ');
      return `${item.name} (${item.type})${descriptors ? ` — ${descriptors}` : ''}`;
    })
    .join('\n');

const formatProfileContext = (payload: Record<string, unknown>) =>
  Object.entries(payload)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!openai) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) ?? {};
  } catch {
    payload = {};
  }

  const items = await prisma.item.findMany({
    where: { userId: user.id },
    select: { name: true, type: true, color: true, material: true, brand: true },
    orderBy: { dateAdded: 'desc' },
    take: 50,
  });

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one wardrobe item before requesting an AI summary.' },
      { status: 400 }
    );
  }

  const existingProfile = await prisma.styleProfile.findUnique({
    where: { userId: user.id },
  });

  const userDetails = formatProfileContext(payload);
  const profileContext = existingProfile
    ? formatProfileContext({
        selfDescription: existingProfile.selfDescription,
        styleGoals: existingProfile.styleGoals,
        lifestyleNotes: existingProfile.lifestyleNotes,
        fitNotes: existingProfile.fitNotes,
        preferredBrands: existingProfile.preferredBrands,
        favoriteColors: existingProfile.favoriteColors,
        budgetFocus: existingProfile.budgetFocus,
        ageRange: existingProfile.ageRange,
        location: existingProfile.location,
        climate: existingProfile.climate,
        aiSummary: existingProfile.aiSummary,
        aiKeywords: existingProfile.aiKeywords,
      })
    : '';

  const prompt = `You are a wardrobe stylist. Study the inventory list and the optional user notes to produce a concise description of their personal style plus a few keywords. Focus on silhouettes, color palettes, fit preferences, climate, and lifestyle cues.\n\nInventory:\n${summarizeInventory(
    items
  )}\n\nUser-provided details:\n${userDetails || 'None provided'}\n\nExisting profile context:\n${
    profileContext || 'No saved profile yet.'
  }\n\nRespond ONLY with valid JSON: { "summary": string (max 120 words), "keywords": array of 3-6 short strings }.`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'Empty LLM response' }, { status: 502 });
    }

    const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const content = block ? block[1] : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.warn('Unable to parse style summary JSON', content, error);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    const parsedRecord = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};

    const summary =
      typeof parsedRecord.summary === 'string'
        ? parsedRecord.summary
        : '';
    const keywords = Array.isArray(parsedRecord.keywords)
      ? parsedRecord.keywords
          .filter((entry: unknown): entry is string => typeof entry === 'string')
          .slice(0, 6)
      : [];

    return NextResponse.json({ summary, keywords });
  } catch (error) {
    console.error('Failed to build style summary', error);
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 });
  }
}
