import { Metadata } from 'next';
import { requireUser } from '../lib/auth';
import { prisma } from '../lib/prisma';
import StyleClient from './StyleClient';

export const metadata: Metadata = {
  title: 'My Style • Style Archive',
  description: 'Describe your personal style and demographics for more relevant looks.',
};

export default async function StylePage() {
  const user = await requireUser();
  const [profile, inventoryCount] = await Promise.all([
    prisma.styleProfile.findUnique({ where: { userId: user.id } }),
    prisma.item.count({ where: { userId: user.id } }),
  ]);

  const initialProfile = profile
    ? {
        selfDescription: profile.selfDescription,
        styleGoals: profile.styleGoals,
        lifestyleNotes: profile.lifestyleNotes,
        fitNotes: profile.fitNotes,
        preferredBrands: profile.preferredBrands,
        favoriteColors: profile.favoriteColors,
        budgetFocus: profile.budgetFocus,
        ageRange: profile.ageRange,
        location: profile.location,
        climate: profile.climate,
        aiSummary: profile.aiSummary,
        aiKeywords: profile.aiKeywords,
        aiUpdatedAt: profile.aiUpdatedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <StyleClient
        initialProfile={initialProfile}
        canSummarize={Boolean(process.env.OPENAI_API_KEY)}
        inventoryCount={inventoryCount}
      />
    </div>
  );
}
