'use client';

import { useCallback, useEffect, useMemo, useState, FormEvent, ReactNode } from 'react';
import Image from 'next/image';
import type { CandidateItem, CandidateVerdict, CandidateEvaluation } from '../lib/types';

type CandidatesClientProps = {
  initialCandidates: CandidateItem[];
  wardrobeCount: number;
};

type CandidateDraft = {
  title: string;
  type: string;
  color: string;
  size: string;
  brand: string;
  material: string;
  description: string;
  notes: string;
  tags: string;
  priceAmount: string;
  priceCurrency: string;
};

const VERDICT_DESCRIPTIONS: Record<CandidateVerdict, string> = {
  buy: 'High fit: unique utility with low overlap, go for it.',
  maybe: 'Mixed signal: some outfit value but overlaps exist, proceed thoughtfully.',
  pass: 'Skip it: redundant or low incremental value versus your wardrobe.',
};

const buildDraftFromCandidate = (candidate: CandidateItem): CandidateDraft => ({
  title: candidate.title ?? '',
  type: candidate.type ?? '',
  color: candidate.color ?? '',
  size: candidate.size ?? '',
  brand: candidate.brand ?? '',
  material: candidate.material ?? '',
  description: candidate.description ?? '',
  notes: candidate.notes ?? '',
  tags: candidate.tags.join(', '),
  priceAmount: candidate.price?.amount != null ? String(candidate.price.amount) : '',
  priceCurrency: candidate.price?.currency ?? 'USD',
});

const ScoreMeter = ({
  label,
  value,
  goodIsHigh = true,
}: {
  label: string;
  value?: number;
  goodIsHigh?: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between text-xs text-gray-600">
      <span>{label}</span>
      <span>{value != null ? `${value}` : '—'}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${
          goodIsHigh ? 'bg-indigo-500' : 'bg-amber-500'
        }`}
        style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
      />
    </div>
    {!goodIsHigh && (
      <span className="text-[10px] text-gray-500">Lower is better</span>
    )}
  </div>
);

type CandidateCardProps = {
  candidate: CandidateItem;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onEvaluate: (id: string) => Promise<void>;
  onToggleCompare: (id: string) => void;
  isSelected: boolean;
  disableSelection: boolean;
};

const CandidateCard = ({
  candidate,
  onSave,
  onEvaluate,
  onToggleCompare,
  isSelected,
  disableSelection,
}: CandidateCardProps) => {
  const [draft, setDraft] = useState<CandidateDraft>(() => buildDraftFromCandidate(candidate));
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(buildDraftFromCandidate(candidate));
    setMessage(null);
  }, [candidate]);

  const handleInputChange = (field: keyof CandidateDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(candidate.id, {
        title: draft.title,
        type: draft.type,
        color: draft.color,
        size: draft.size,
        brand: draft.brand,
        material: draft.material,
        description: draft.description,
        notes: draft.notes,
        tags: draft.tags,
        price: {
          amount: draft.priceAmount ? Number(draft.priceAmount) : null,
          currency: draft.priceCurrency,
        },
      });
      setMessage('Saved');
    } catch (error) {
      console.error(error);
      setMessage('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluateClick = async () => {
    setEvaluating(true);
    setMessage(null);
    try {
      await onEvaluate(candidate.id);
      setMessage('Evaluation updated');
    } catch (error) {
      console.error(error);
      setMessage('Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const evaluation = candidate.evaluation;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all ${
        isSelected ? 'border-indigo-200 ring-2 ring-indigo-400 ring-offset-2' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <div className="flex h-32 w-full max-w-[160px] items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            {candidate.heroImage ? (
              <Image
                src={candidate.heroImage}
                alt={candidate.title ?? 'Candidate item'}
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs uppercase text-gray-400">No image</span>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">{candidate.sourceDomain ?? 'Imported link'}</p>
                <h3 className="text-lg font-semibold text-gray-900">{candidate.title ?? 'Untitled item'}</h3>
                <p className="text-sm text-gray-500">
                  Status: <span className="capitalize">{candidate.status}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => onToggleCompare(candidate.id)}
                  disabled={!isSelected && disableSelection}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isSelected
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-40'
                  }`}
                >
                  {isSelected ? 'Selected for compare' : 'Compare'}
                </button>
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  {candidate.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm text-gray-600">
                Title
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.title}
                  onChange={handleInputChange('title')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Brand
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.brand}
                  onChange={handleInputChange('brand')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Type
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.type}
                  onChange={handleInputChange('type')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Color
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.color}
                  onChange={handleInputChange('color')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Size / Fit
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.size}
                  onChange={handleInputChange('size')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Material
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.material}
                  onChange={handleInputChange('material')}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Price
                <div className="mt-1 flex gap-2">
                  <input
                    className="w-2/3 rounded border border-gray-200 px-3 py-2 text-gray-900"
                    value={draft.priceAmount}
                    onChange={handleInputChange('priceAmount')}
                    placeholder="Amount"
                  />
                  <input
                    className="w-1/3 rounded border border-gray-200 px-3 py-2 text-gray-900 uppercase"
                    value={draft.priceCurrency}
                    onChange={handleInputChange('priceCurrency')}
                    placeholder="USD"
                  />
                </div>
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Tags
                <input
                  className="mt-1 rounded border border-gray-200 px-3 py-2 text-gray-900"
                  value={draft.tags}
                  onChange={handleInputChange('tags')}
                  placeholder="comma separated"
                />
              </label>
            </div>

            <label className="flex flex-col text-sm text-gray-600">
              Description
              <textarea
                className="mt-1 min-h-[80px] rounded border border-gray-200 px-3 py-2 text-gray-900"
                value={draft.description}
                onChange={handleInputChange('description')}
              />
            </label>

            <label className="flex flex-col text-sm text-gray-600">
              Notes
              <textarea
                className="mt-1 min-h-[60px] rounded border border-gray-200 px-3 py-2 text-gray-900"
                value={draft.notes}
                onChange={handleInputChange('notes')}
              />
            </label>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-500">{message}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleEvaluateClick}
                  disabled={evaluating}
                  className="rounded border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                >
                  {evaluating ? 'Running…' : 'Run evaluation'}
                </button>
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  View link
                </a>
              </div>
            </div>
          </div>
        </div>

        {evaluation ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-3 flex flex-col gap-1">
              <span className="text-xs uppercase text-gray-500">Verdict</span>
              <span className="text-2xl font-semibold capitalize text-gray-900">{evaluation.verdict}</span>
              <p className="text-sm text-gray-500">{VERDICT_DESCRIPTIONS[evaluation.verdict]}</p>
              {evaluation.explanation && <p className="text-sm text-gray-600">{evaluation.explanation}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ScoreMeter label="Compatibility" value={evaluation.compatibilityScore} />
              <ScoreMeter label="Redundancy risk" value={evaluation.redundancyScore} goodIsHigh={false} />
              <ScoreMeter label="Gap-fill" value={evaluation.gapScore} />
              <ScoreMeter label="Versatility" value={evaluation.versatilityScore} />
            </div>
            {evaluation.reasoning && evaluation.reasoning.length > 0 && (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-600">
                {evaluation.reasoning.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            Run an evaluation to see verdict, reasoning, and scores.
          </div>
        )}
      </div>
    </div>
  );
};

const CandidatesClient = ({ initialCandidates, wardrobeCount }: CandidatesClientProps) => {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [url, setUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const MAX_COMPARE = 4;
  const MIN_COMPARE = 2;

  const upsertCandidate = useCallback((candidate: CandidateItem) => {
    setCandidates((prev) => {
      const index = prev.findIndex((entry) => entry.id === candidate.id);
      if (index === -1) {
        return [candidate, ...prev];
      }
      const next = [...prev];
      next[index] = candidate;
      return next;
    });
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!url) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/candidate-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to import link');
      }
      const payload = await response.json();
      if (payload.candidate) {
        upsertCandidate(payload.candidate);
      }
      setUrl('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to import that URL');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/candidate-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to save candidate');
    }
    const data = await response.json();
    if (data.candidate) {
      upsertCandidate(data.candidate);
    }
  };

  const handleEvaluate = async (id: string) => {
    const response = await fetch(`/api/candidate-items/${id}/evaluate`, {
      method: 'POST',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Evaluation failed');
    }
    const data = await response.json();
    if (data.candidate) {
      upsertCandidate(data.candidate);
    }
  };

  const emptyState = candidates.length === 0;
  const selectedCandidates = useMemo(
    () =>
      selectedIds
        .map((id) => candidates.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is CandidateItem => Boolean(candidate)),
    [selectedIds, candidates]
  );
  const compareLimitReached = selectedIds.length >= MAX_COMPARE;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((candidateId) => candidateId !== id);
      }
      if (prev.length >= MAX_COMPARE) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const clearSelection = () => setSelectedIds([]);
  const removeSelection = (id: string) =>
    setSelectedIds((prev) => prev.filter((candidateId) => candidateId !== id));

  const computeCompositeScore = (candidate: CandidateItem) => {
    const evaluation = candidate.evaluation;
    if (!evaluation) return 0;
    return (
      (evaluation.compatibilityScore ?? 0) +
      (evaluation.gapScore ?? 0) +
      (evaluation.versatilityScore ?? 0) -
      (evaluation.redundancyScore ?? 0)
    );
  };

  const topCandidateId = useMemo(() => {
    if (selectedCandidates.length < MIN_COMPARE) return null;
    return selectedCandidates.reduce((bestId: string | null, candidate) => {
      if (!bestId) return candidate.id;
      const currentScore = computeCompositeScore(candidate);
      const bestScore = computeCompositeScore(
        selectedCandidates.find((entry) => entry.id === bestId) ?? candidate
      );
      return currentScore > bestScore ? candidate.id : bestId;
    }, null);
  }, [selectedCandidates]);

  const ComparisonPanel = () => {
    if (selectedCandidates.length < MIN_COMPARE) return null;

    const rows: Array<{
      label: string;
      key: string;
      goodIsHigh?: boolean;
      render?: (candidate: CandidateItem) => ReactNode;
    }> = [
      { label: 'Verdict', key: 'verdict' },
      { label: 'Compatibility', key: 'compatibilityScore' },
      { label: 'Gap-fill', key: 'gapScore' },
      { label: 'Versatility', key: 'versatilityScore' },
      { label: 'Redundancy (lower is safer)', key: 'redundancyScore', goodIsHigh: false },
      {
        label: 'Price',
        key: 'price',
        render: (candidate) =>
          candidate.price?.amount != null
            ? new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: candidate.price.currency ?? 'USD',
              }).format(candidate.price.amount)
            : '—',
      },
      {
        label: 'Tags',
        key: 'tags',
        render: (candidate) =>
          candidate.tags.length > 0 ? candidate.tags.join(', ') : <span className="text-gray-400">—</span>,
      },
    ];

    const formatScore = (candidate: CandidateItem, key: string, goodIsHigh = true) => {
      const value = candidate.evaluation?.[key as keyof CandidateEvaluation];
      if (value == null || typeof value !== 'number') {
        return '—';
      }
      const rounded = Math.round(value);
      return goodIsHigh ? `${rounded}` : `${rounded}`;
    };

    return (
      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 sm:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Comparison mode</p>
              <h2 className="text-lg font-semibold text-gray-900">
                Comparing {selectedCandidates.length} items
              </h2>
              <p className="text-sm text-gray-500">
                Based on evaluation scores — aligns with the comparison requirement in the V1 scope.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr>
                  <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500">Metric</th>
                  {selectedCandidates.map((candidate) => {
                    const isTopPick = topCandidateId === candidate.id;
                    return (
                      <th key={candidate.id} className="relative py-2 px-4 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{candidate.title ?? 'Untitled'}</span>
                          <button
                            type="button"
                            onClick={() => removeSelection(candidate.id)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                            aria-label="Remove from comparison"
                          >
                            ×
                          </button>
                        </div>
                        {isTopPick && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                            Top pick
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-gray-100">
                    <td className="py-3 pr-4 text-xs font-medium uppercase text-gray-500">{row.label}</td>
                    {selectedCandidates.map((candidate) => (
                      <td key={`${candidate.id}-${row.key}`} className="py-3 px-4 align-top">
                        {row.key === 'verdict' && candidate.evaluation ? (
                          <span className="capitalize">{candidate.evaluation.verdict}</span>
                        ) : row.render ? (
                          row.render(candidate)
                        ) : (
                          formatScore(candidate, row.key, row.goodIsHigh !== false)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Evaluate a new item</h1>
        <p className="mt-2 text-sm text-gray-600">
          Paste a product URL to import metadata, adjust any fields, then run an evaluation against your wardrobe.
        </p>
        {wardrobeCount === 0 && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Add at least one wardrobe item to unlock richer evaluations.
          </div>
        )}
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://shop.example.com/item"
            className="flex-1 rounded border border-gray-300 px-4 py-3 text-gray-900"
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {creating ? 'Importing…' : 'Import item'}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
      </div>

      {emptyState ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">
          No candidate items yet. Paste a product link above to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onSave={handleSave}
              onEvaluate={handleEvaluate}
              onToggleCompare={toggleSelected}
              isSelected={selectedIds.includes(candidate.id)}
              disableSelection={compareLimitReached}
            />
          ))}
        </div>
      )}
      <ComparisonPanel />
    </div>
  );
};

export default CandidatesClient;
