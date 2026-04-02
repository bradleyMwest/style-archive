import OpenAI from 'openai';
import { parserResult } from './utils';
import type { ParserResult, ProductImportDraft } from './types';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const MODEL = process.env.PRODUCT_IMPORT_LLM_MODEL || 'gpt-4o-mini';
const TARGET_FIELDS: (keyof ParserResult['fields'])[] = ['color', 'size', 'material', 'description', 'tags'];

const shouldEnrich = (draft: ProductImportDraft) => {
  const missingColor = !draft.color;
  const missingSize = !draft.size;
  const missingMaterial = !draft.material;
  const missingDescription = !draft.description;
  const missingTags = !draft.tags || draft.tags.length === 0;
  return missingColor || missingSize || missingMaterial || missingDescription || missingTags;
};

const buildPrompt = (draft: ProductImportDraft) => {
  const parts = [
    'You are an ecommerce product metadata assistant. Fill in missing clothing details.',
    'Return JSON with keys: color, size, material, description, tags.',
    'If unsure, make the best reasonable inference but avoid inventing impossible facts.',
    'Use an array of keywords for tags. Keep descriptions under 3 sentences.',
    '',
    `Title: ${draft.title || 'Unknown'}`,
    `Brand: ${draft.brand || 'Unknown'}`,
    `Type: ${draft.type || 'Unknown'}`,
    `Current Color: ${draft.color || 'Unknown'}`,
    `Current Size: ${draft.size || 'Unknown'}`,
    `Material: ${draft.material || 'Unknown'}`,
    `Price: ${draft.price?.text || 'Unknown'}`,
    `Description: ${draft.description || 'Not provided'}`,
    `Listing URL: ${draft.url}`,
  ];
  return parts.join('\n');
};

export const enrichDraftWithLlm = async (
  draft: ProductImportDraft
): Promise<ParserResult | null> => {
  if (!openai || !shouldEnrich(draft)) {
    return null;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: buildPrompt(draft),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content);

    const fields = {
      color: typeof parsed.color === 'string' ? parsed.color : undefined,
      size: typeof parsed.size === 'string' ? parsed.size : undefined,
      material: typeof parsed.material === 'string' ? parsed.material : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim().length > 0)
        : undefined,
    };

    const hasData = TARGET_FIELDS.some((field) => {
      const value = (fields as Record<string, unknown>)[field as string];
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });

    if (!hasData) {
      return null;
    }

    return parserResult('llm_enrichment', fields, undefined, 'LLM enrichment');
  } catch (error) {
    console.warn('LLM enrichment failed', error);
    return null;
  }
};
