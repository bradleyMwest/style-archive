'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

interface ShopSuggestion {
  category: string;
  description: string;
  searchQueries: string[];
  suggestedBrands: string[];
  priceAnchors: string;
  reason: string;
}

export default function ShopClient() {
  const [suggestions, setSuggestions] = useState<ShopSuggestion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [source, setSource] = useState<'llm' | 'fallback' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/shop-recommendations', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to load recommendations');
      }
      const data = await response.json();
      setSuggestions(data.suggestions ?? []);
      setSource(data.source ?? null);
      setStatus('ready');
    } catch (error) {
      console.error('Unable to load shop recommendations', error);
      setErrorMessage('Unable to load recommendations right now.');
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const cards = useMemo(() => suggestions, [suggestions]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop</h1>
          <p className="text-sm text-gray-600">
            Discover brands and pieces that complement your current wardrobe.
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={status === 'loading'}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Refreshing…' : 'Refresh Suggestions'}
        </button>
      </div>

      {source === 'fallback' && (
        <div className="mb-4 rounded bg-amber-50 p-4 text-sm text-amber-700">
          Using sample brands while wardrobe syncs.
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="rounded bg-red-50 p-4 text-sm text-red-700 mb-4">{errorMessage}</div>
      )}

      {status === 'loading' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-lg border border-gray-100 p-4 space-y-4">
              <div className="w-full h-48 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p className="text-gray-600">No recommendations yet. Add more wardrobe items and refresh.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((item, index) => (
            <article
              key={`${item.category}-${index}`}
              className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200">
                <Image
                  src={`https://source.unsplash.com/collection/190727/600x400?sig=${index}`}
                  alt={item.category}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.category}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 font-semibold">Suggested Brands</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.suggestedBrands.map((brand) => (
                      <span key={brand} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1">
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 font-semibold">Search Queries</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.searchQueries.map((query) => (
                      <span
                        key={query}
                        className="text-xs font-medium text-blue-600 bg-blue-50 rounded px-2 py-1"
                      >
                        {query}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-600">{item.priceAnchors}</p>
                <p className="text-sm text-gray-700">{item.reason}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
