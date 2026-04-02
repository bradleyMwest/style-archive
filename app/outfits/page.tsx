'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Item } from '../lib/types';

type SuggestionStatus = 'liked' | 'try' | 'nope';

interface AISuggestion {
  id: string;
  name: string;
  itemIds: string[];
  description: string;
  reasoning: string;
  status: SuggestionStatus;
}

const STATUS_METADATA: Record<SuggestionStatus, { title: string; helper: string; gradient: string }> = {
  liked: { title: 'Favorites', helper: 'Looks you loved', gradient: 'from-purple-200 to-rose-200' },
  try: { title: 'Want to Try', helper: 'Looks to experiment with soon', gradient: 'from-blue-100 to-purple-100' },
  nope: { title: 'Passed', helper: 'Looks you are skipping', gradient: 'from-gray-100 to-gray-50' },
};

interface SavedOutfit {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  createdAt: string;
}

export default function Outfits() {
  const [isLoading, setIsLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [manualOutfits, setManualOutfits] = useState<SavedOutfit[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/outfit-suggestions');
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const data = await response.json();
      setSuggestions(data.suggestions ?? []);
      setSuggestionError(null);
    } catch (error) {
      console.error('Unable to load outfit suggestions', error);
      setSuggestionError('Unable to load saved outfit suggestions.');
    }
  };

  const fetchManualOutfits = async () => {
    try {
      const response = await fetch('/api/outfits');
      if (!response.ok) throw new Error('Failed to fetch outfits');
      const data = await response.json();
      setManualOutfits(data.outfits ?? []);
      setManualError(null);
    } catch (error) {
      console.error('Unable to load outfits', error);
      setManualError('Unable to load saved outfits.');
    }
  };

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await fetch('/api/items');
        if (!response.ok) {
          throw new Error('Failed to load inventory');
        }
        const data = await response.json();
        setInventoryItems(data);
      } catch (error) {
        console.error('Unable to load inventory', error);
        setInventoryError('Unable to load your wardrobe items right now.');
      } finally {
        setInventoryLoaded(true);
      }
    };
    loadItems();
    fetchSuggestions();
    fetchManualOutfits();
  }, []);

  const getAISuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/suggest-outfits', {
        method: 'POST',
      });

      if (response.ok) {
        const payload = await response.json();
        await fetchSuggestions();
        if (payload.created === 0) {
          alert('No new outfits were generated. Try again after adding more items.');
        }
      } else {
        alert('Failed to get outfit suggestions. Please try again.');
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
      alert('Error getting suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSuggestionStatus = async (id: string, nextStatus: SuggestionStatus) => {
    try {
      const response = await fetch(`/api/outfit-suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error('Failed to update');
      await fetchSuggestions();
    } catch (error) {
      console.error('Unable to update suggestion', error);
      alert('Unable to update outfit status. Please try again.');
    }
  };

  const deleteSuggestion = async (id: string) => {
    if (!confirm('Delete this outfit suggestion?')) {
      return;
    }
    try {
      const response = await fetch(`/api/outfit-suggestions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      await fetchSuggestions();
    } catch (error) {
      console.error('Unable to delete suggestion', error);
      alert('Unable to delete this suggestion. Please try again.');
    }
  };

  const inventoryLookup = useMemo(() => {
    return inventoryItems.reduce<Record<string, Item>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [inventoryItems]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Outfits</h1>
        <div className="flex space-x-4">
          <button
            onClick={getAISuggestions}
            disabled={isLoading || inventoryItems.length < 2}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Getting Suggestions...' : 'Get AI Suggestions'}
          </button>
          <Link
            href="/outfits/create"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Outfit
          </Link>
        </div>
      </div>

      {inventoryError && (
        <div className="mb-6 rounded bg-red-50 p-4 text-sm text-red-700">{inventoryError}</div>
      )}
      {!inventoryError && inventoryItems.length === 0 && (
        <div className="mb-6 rounded bg-blue-50 p-4 text-sm text-blue-700">
          Add a few items to your wardrobe to unlock outfit recommendations.
        </div>
      )}

      {/* AI Suggestions */}
      <div className="space-y-10">
        {suggestionError && (
          <div className="rounded bg-red-50 p-4 text-sm text-red-700">{suggestionError}</div>
        )}
        {(['liked', 'try', 'nope'] as SuggestionStatus[]).map((status) => (
          <SuggestionGroup
            key={status}
            title={STATUS_METADATA[status].title}
            helper={STATUS_METADATA[status].helper}
            gradient={STATUS_METADATA[status].gradient}
            suggestions={suggestions.filter((s) => s.status === status)}
            inventoryLookup={inventoryLookup}
            inventoryLoaded={inventoryLoaded}
            currentStatus={status}
            onStatusChange={(id, nextStatus) => updateSuggestionStatus(id, nextStatus)}
            onDelete={deleteSuggestion}
          />
        ))}
      </div>

      {/* Saved manual outfits */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Saved Outfits</h2>
            <p className="text-sm text-gray-500">Looks you curated manually.</p>
          </div>
          <Link href="/outfits/create" className="text-blue-600 text-sm font-semibold hover:underline">
            New Outfit →
          </Link>
        </div>
        {manualError && (
          <div className="rounded bg-red-50 p-4 text-sm text-red-700 mb-4">{manualError}</div>
        )}
        {manualOutfits.length === 0 ? (
          <p className="text-gray-600 text-sm">No saved outfits yet. Create one to see it here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manualOutfits.map((outfit) => (
              <div key={outfit.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{outfit.name}</h3>
                  {outfit.description && (
                    <p className="text-sm text-gray-600">{outfit.description}</p>
                  )}
                </div>
                <SuggestionItems
                  itemIds={outfit.itemIds}
                  inventoryLookup={inventoryLookup}
                  inventoryLoaded={inventoryLoaded}
                />
                <p className="text-xs text-gray-400">
                  Saved {new Date(outfit.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inventory preview */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Wardrobe Items</h2>
        {inventoryItems.length === 0 ? (
          <p className="text-gray-600">No items saved yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventoryItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-lg font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {item.type} • {item.color}
                  </p>
                  {item.tags && (
                    <p className="text-xs text-gray-500">
                      {Array.isArray(item.tags) ? item.tags.join(', ') : item.tags}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SuggestionGroupProps {
  title: string;
  helper: string;
  gradient: string;
  suggestions: AISuggestion[];
  inventoryLookup: Record<string, Item>;
  inventoryLoaded: boolean;
  currentStatus: SuggestionStatus;
  onStatusChange: (id: string, nextStatus: SuggestionStatus) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

function SuggestionGroup({
  title,
  helper,
  gradient,
  suggestions,
  inventoryLookup,
  inventoryLoaded,
  currentStatus,
  onStatusChange,
  onDelete,
}: SuggestionGroupProps) {
  const actions: { label: string; value: SuggestionStatus; style: string }[] = [
    { label: 'Like', value: 'liked', style: 'bg-pink-600 text-white' },
    { label: 'Try Later', value: 'try', style: 'bg-blue-600 text-white' },
    { label: 'Pass', value: 'nope', style: 'bg-gray-200 text-gray-700' },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{helper}</p>
        </div>
        <span className="text-sm text-gray-600">{suggestions.length} looks</span>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-gray-500 text-sm">No outfits in this bucket yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`bg-gradient-to-br ${gradient} rounded-lg shadow border border-white/40`}
            >
              <div className="p-5 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => onDelete(suggestion.id)}
                  className="absolute top-3 right-3 text-gray-500 hover:text-red-600 text-sm"
                  aria-label="Delete suggestion"
                >
                  Delete
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{suggestion.name}</h3>
                  <p className="text-sm text-gray-700">{suggestion.description}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-800">Items</h4>
                  <SuggestionItems
                    itemIds={suggestion.itemIds}
                    inventoryLookup={inventoryLookup}
                    inventoryLoaded={inventoryLoaded}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Why it works</h4>
                  <p className="text-sm text-gray-700">{suggestion.reasoning}</p>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  {actions
                    .filter((action) => action.value !== currentStatus)
                    .map((action) => (
                      <button
                        key={action.value}
                        onClick={() => onStatusChange(suggestion.id, action.value)}
                        className={`px-3 py-1 rounded text-sm font-medium ${action.style}`}
                      >
                        {action.label}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SuggestionItems({
  itemIds,
  inventoryLookup,
  inventoryLoaded,
}: {
  itemIds: string[];
  inventoryLookup: Record<string, Item>;
  inventoryLoaded: boolean;
}) {
  if (itemIds.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {inventoryLoaded
          ? 'No items available for this look. Edit the outfit to replace missing pieces.'
          : 'Loading item details…'}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {itemIds.map((id) => {
        const match = inventoryLookup[id];
        if (!match) {
          return (
            <li key={id} className="text-sm text-amber-600">
              {inventoryLoaded
                ? `Item was removed from your wardrobe (${id}). Edit this outfit to swap it out.`
                : 'Loading item details…'}
            </li>
          );
        }
        return (
          <li key={id} className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded overflow-hidden border border-gray-200 bg-gray-50">
              <Image src={match.image} alt={match.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{match.name}</p>
              <p className="text-xs text-gray-500 capitalize">
                {match.type} • {match.color}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
