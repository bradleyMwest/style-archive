'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

interface ProductResult {
  id: string;
  name: string;
  brand: string | null;
  merchant: string | null;
  price: string | null;
  currency: string | null;
  image: string | null;
  url: string;
}

interface ShopSuggestion {
  baseItem: {
    id: string;
    name: string;
    color: string;
    image: string | null;
  };
  complementaryCategory: string;
  searchQuery: string;
  reasoning: string;
  priceExpectation: string;
  products: ProductResult[];
}

interface RecommendationMeta {
  source: 'rakuten' | 'llm' | 'fallback' | null;
  profileUsed: boolean;
  profileSummary: string | null;
}

export default function ShopClient() {
  const [suggestions, setSuggestions] = useState<ShopSuggestion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [meta, setMeta] = useState<RecommendationMeta>({
    source: null,
    profileUsed: false,
    profileSummary: null,
  });
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
      setMeta({
        source: (data.source as RecommendationMeta['source']) ?? null,
        profileUsed: Boolean(data.profileUsed),
        profileSummary: typeof data.profileSummary === 'string' ? data.profileSummary : null,
      });
      setStatus('ready');
    } catch (error) {
      console.error('Unable to load shop recommendations', error);
      setErrorMessage('Unable to load recommendations right now.');
      setStatus('error');
      setMeta({ source: null, profileUsed: false, profileSummary: null });
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

      {meta.source === 'fallback' && (
        <div className="mb-4 rounded bg-amber-50 p-4 text-sm text-amber-700">
          Using sample brands while wardrobe syncs.
        </div>
      )}

      {status === 'ready' && (
        <div
          className={`mb-6 rounded border px-4 py-3 text-sm ${
            meta.profileUsed
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-blue-100 bg-blue-50 text-blue-800'
          }`}
        >
          {meta.profileUsed ? (
            <span>
              Personalizing these picks with your style profile
              {meta.profileSummary ? `: “${meta.profileSummary}”` : '.'}
            </span>
          ) : (
            <span>
              Add details in the <a href="/style" className="underline font-medium">My Style</a> tab to unlock more
              personalized shopping ideas.
            </span>
          )}
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="rounded bg-red-50 p-4 text-sm text-red-700 mb-4">{errorMessage}</div>
      )}

      {status === 'loading' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-lg border border-gray-100 p-4 space-y-4">
              <div className="w-full h-48 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p className="text-gray-600">No recommendations yet. Add more wardrobe items and refresh.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cards.map((item) => (
            <article
              key={`${item.baseItem.id}-${item.complementaryCategory}`}
              className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="grid gap-4 p-5">
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-20 rounded-md overflow-hidden bg-gray-100">
                    {item.baseItem.image ? (
                      <Image
                        src={item.baseItem.image}
                        alt={item.baseItem.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase text-gray-500">Base Item</p>
                    <p className="text-sm font-semibold text-gray-900">{item.baseItem.name}</p>
                    <p className="text-xs text-gray-600">{item.baseItem.color}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 font-semibold">Complement</p>
                  <h3 className="text-lg font-semibold text-gray-900">{item.complementaryCategory}</h3>
                  <p className="text-sm text-gray-600">{item.reasoning}</p>
                  <p className="text-sm font-semibold text-green-600 mt-1">{item.priceExpectation}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 font-semibold">Search Query</p>
                  <span className="mt-1 inline-flex text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-1">
                    {item.searchQuery}
                  </span>
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase text-gray-500 font-semibold">Rakuten Picks</p>
                  {item.products.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      We couldn’t load live products for this query. Try refreshing or adjusting your wardrobe.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {item.products.map((product) => (
                        <li key={product.id}>
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex gap-3 rounded border border-gray-100 hover:border-blue-200 transition p-3"
                          >
                            <div className="w-16 h-16 bg-gray-50 rounded flex-shrink-0 overflow-hidden">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt={product.name}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                  —
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-600">
                                {[product.brand, product.merchant].filter(Boolean).join(' • ')}
                              </p>
                              {product.price && (
                                <p className="text-sm font-semibold text-green-600">
                                  {product.price}
                                  {product.currency ? ` ${product.currency}` : ''}
                                </p>
                              )}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
