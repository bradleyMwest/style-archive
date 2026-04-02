'use client';

import { useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStyleProfile } from '../actions/style-profile';
import { StyleProfile } from '../lib/types';

type StyleProfileFormValues = StyleProfile & {
  aiUpdatedAt: string | null;
};

type StyleClientProps = {
  initialProfile: StyleProfileFormValues | null;
  canSummarize: boolean;
  inventoryCount: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70"
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Save Profile'}
    </button>
  );
}

export default function StyleClient({ initialProfile, canSummarize, inventoryCount }: StyleClientProps) {
  const [aiSummary, setAiSummary] = useState(initialProfile?.aiSummary ?? '');
  const [aiKeywords, setAiKeywords] = useState(initialProfile?.aiKeywords ?? '');
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleGenerateSummary = async () => {
    if (!canSummarize || !formRef.current) return;
    setSummaryError(null);
    setSummaryStatus('loading');

    const currentForm = new FormData(formRef.current);
    const payload = Object.fromEntries(currentForm.entries());

    try {
      const response = await fetch('/api/style-profile/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? 'Unable to summarize style right now.');
      }
      const result = await response.json();
      setAiSummary(result.summary ?? '');
      setAiKeywords(Array.isArray(result.keywords) ? result.keywords.join(', ') : '');
      setSummaryStatus('success');
    } catch (error) {
      setSummaryStatus('error');
      setSummaryError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">My Style</h1>
            <p className="text-sm text-gray-600">
              Describe your personal style and lifestyle details to tailor outfit and shopping suggestions.
            </p>
          </div>
          {!canSummarize && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1">
              Connect an OpenAI key to enable AI summaries
            </span>
          )}
        </div>
        {inventoryCount < 3 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Add a few more wardrobe items to unlock richer AI summaries. We recommend at least 3 pieces.
          </p>
        )}
        {initialProfile?.aiUpdatedAt && (
          <p className="text-xs text-gray-500">
            Last AI summary updated on {new Date(initialProfile.aiUpdatedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <form
        ref={formRef}
        action={saveStyleProfile}
        className="grid grid-cols-1 gap-8 lg:grid-cols-5"
      >
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="selfDescription" className="block text-sm font-medium text-gray-700">
                How would you describe your style?
              </label>
              <textarea
                id="selfDescription"
                name="selfDescription"
                defaultValue={initialProfile?.selfDescription ?? ''}
                className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                rows={4}
              />
            </div>
            <div>
              <label htmlFor="styleGoals" className="block text-sm font-medium text-gray-700">
                Style goals for this season
              </label>
              <textarea
                id="styleGoals"
                name="styleGoals"
                defaultValue={initialProfile?.styleGoals ?? ''}
                className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="preferredBrands" className="block text-sm font-medium text-gray-700">
                  Favorite brands
                </label>
                <textarea
                  id="preferredBrands"
                  name="preferredBrands"
                  defaultValue={initialProfile?.preferredBrands ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                  rows={3}
                />
              </div>
              <div>
                <label htmlFor="favoriteColors" className="block text-sm font-medium text-gray-700">
                  Favorite colors or palettes
                </label>
                <textarea
                  id="favoriteColors"
                  name="favoriteColors"
                  defaultValue={initialProfile?.favoriteColors ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                  rows={3}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="lifestyleNotes" className="block text-sm font-medium text-gray-700">
                  Lifestyle notes
                </label>
                <textarea
                  id="lifestyleNotes"
                  name="lifestyleNotes"
                  defaultValue={initialProfile?.lifestyleNotes ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                  rows={3}
                />
              </div>
              <div>
                <label htmlFor="fitNotes" className="block text-sm font-medium text-gray-700">
                  Fit notes
                </label>
                <textarea
                  id="fitNotes"
                  name="fitNotes"
                  defaultValue={initialProfile?.fitNotes ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Demographic & Climate Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ageRange" className="block text-sm font-medium text-gray-700">
                  Age range
                </label>
                <input
                  type="text"
                  id="ageRange"
                  name="ageRange"
                  defaultValue={initialProfile?.ageRange ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-2.5 text-sm focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <label htmlFor="budgetFocus" className="block text-sm font-medium text-gray-700">
                  Preferred budget
                </label>
                <input
                  type="text"
                  id="budgetFocus"
                  name="budgetFocus"
                  defaultValue={initialProfile?.budgetFocus ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-2.5 text-sm focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  defaultValue={initialProfile?.location ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-2.5 text-sm focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <label htmlFor="climate" className="block text-sm font-medium text-gray-700">
                  Climate
                </label>
                <input
                  type="text"
                  id="climate"
                  name="climate"
                  defaultValue={initialProfile?.climate ?? ''}
                  className="mt-1 block w-full rounded border border-gray-300 p-2.5 text-sm focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded border border-gray-200 p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Style Summary</h2>
                <p className="text-sm text-gray-600">Let AI scan your wardrobe details and capture core themes.</p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={!canSummarize || summaryStatus === 'loading'}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                {summaryStatus === 'loading' ? 'Summarizing…' : 'Generate Summary'}
              </button>
            </div>
            {summaryStatus === 'error' && summaryError && (
              <p className="text-sm text-red-600">{summaryError}</p>
            )}
            {summaryStatus === 'success' && (
              <p className="text-sm text-green-600">Summary updated — remember to save your profile.</p>
            )}
            <div>
              <label htmlFor="aiSummary" className="block text-sm font-medium text-gray-700">
                Summary
              </label>
              <textarea
                id="aiSummary"
                name="aiSummary"
                value={aiSummary}
                onChange={(event) => setAiSummary(event.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-3 text-sm focus:border-gray-900 focus:ring-gray-900"
                rows={6}
                placeholder="AI summary will appear here."
              />
            </div>
            <div>
              <label htmlFor="aiKeywords" className="block text-sm font-medium text-gray-700">
                Keywords (comma separated)
              </label>
              <input
                type="text"
                id="aiKeywords"
                name="aiKeywords"
                value={aiKeywords}
                onChange={(event) => setAiKeywords(event.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2.5 text-sm focus:border-gray-900 focus:ring-gray-900"
                placeholder="minimal, tonal, relaxed tailoring"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </div>
      </form>
    </section>
  );
}
