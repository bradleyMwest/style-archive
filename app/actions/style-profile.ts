'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '../lib/prisma';
import { requireUser } from '../lib/auth';

const stringOrNull = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const pickFields = (formData: FormData) => ({
  selfDescription: stringOrNull(formData.get('selfDescription')),
  styleGoals: stringOrNull(formData.get('styleGoals')),
  lifestyleNotes: stringOrNull(formData.get('lifestyleNotes')),
  fitNotes: stringOrNull(formData.get('fitNotes')),
  preferredBrands: stringOrNull(formData.get('preferredBrands')),
  favoriteColors: stringOrNull(formData.get('favoriteColors')),
  budgetFocus: stringOrNull(formData.get('budgetFocus')),
  ageRange: stringOrNull(formData.get('ageRange')),
  location: stringOrNull(formData.get('location')),
  climate: stringOrNull(formData.get('climate')),
  aiSummary: stringOrNull(formData.get('aiSummary')),
  aiKeywords: stringOrNull(formData.get('aiKeywords')),
});

export async function saveStyleProfile(formData: FormData) {
  const user = await requireUser();
  const values = pickFields(formData);

  const existing = await prisma.styleProfile.findUnique({
    where: { userId: user.id },
    select: { aiSummary: true, aiUpdatedAt: true },
  });

  const aiSummaryChanged = values.aiSummary !== (existing?.aiSummary ?? null);
  const aiUpdatedAt = values.aiSummary
    ? aiSummaryChanged
      ? new Date()
      : existing?.aiUpdatedAt ?? new Date()
    : null;

  await prisma.styleProfile.upsert({
    where: { userId: user.id },
    update: {
      ...values,
      aiUpdatedAt,
    },
    create: {
      userId: user.id,
      ...values,
      aiUpdatedAt,
    },
  });

  revalidatePath('/style');
  revalidatePath('/shop');
}
