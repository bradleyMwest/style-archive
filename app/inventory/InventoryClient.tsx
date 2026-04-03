'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Item } from '../lib/types';

interface InventoryClientProps {
  items: Item[];
}

export default function InventoryClient({ items }: InventoryClientProps) {
  const [localItems, setLocalItems] = useState(items);
  const [sortKey, setSortKey] = useState<'name' | 'brand' | 'type' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => Array.from(new Set(localItems.map((item) => item.type))).sort(),
    [localItems]
  );

  const brandOptions = useMemo(
    () =>
      Array.from(
        new Set(
          localItems
            .map((item) => item.brand?.trim())
            .filter((brand): brand is string => Boolean(brand && brand.length > 0))
        )
      ).sort(),
    [localItems]
  );

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    const passesSearch = (item: Item) => {
      if (!normalizedSearch) return true;
      const haystack = [item.name, item.color, item.brand, item.type]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return haystack.includes(normalizedSearch);
    };

    const typeFiltered =
      filterType === 'all' ? localItems : localItems.filter((item) => item.type === filterType);

    const brandFiltered =
      filterBrand === 'all' ? typeFiltered : typeFiltered.filter((item) => item.brand === filterBrand);

    const finalFiltered = brandFiltered.filter(passesSearch);

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    return [...finalFiltered].sort((a, b) => {
      if (sortKey === 'date') {
        const dateA = new Date(a.dateAdded).getTime();
        const dateB = new Date(b.dateAdded).getTime();
        return (dateA - dateB) * directionMultiplier;
      }

      const getComparable = (value: string | undefined) =>
        (value || '').toLocaleLowerCase();

      const valueA = getComparable(
        sortKey === 'name' ? a.name : sortKey === 'brand' ? a.brand : a.type
      );
      const valueB = getComparable(
        sortKey === 'name' ? b.name : sortKey === 'brand' ? b.brand : b.type
      );

      if (valueA === valueB) {
        return 0;
      }

      return valueA > valueB ? directionMultiplier : -directionMultiplier;
    });
  }, [localItems, filterType, filterBrand, searchTerm, sortDirection, sortKey]);

  const hasMatches = filteredAndSortedItems.length > 0;
  const categoryCoverage = useMemo(() => {
    if (localItems.length === 0) {
      return {
        total: 0,
        uniqueCount: 0,
        topCategory: null as null | { type: string; count: number },
        gaps: [] as Array<{ type: string; count: number }>,
      };
    }
    const counts: Record<string, number> = {};
    localItems.forEach((item) => {
      const key = item.type || 'Uncategorized';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    const average = localItems.length / Math.max(sorted.length, 1);
    const underrepresented = sorted
      .filter((entry) => entry.count <= Math.max(1, Math.floor(average / 2)))
      .slice(-3);
    return {
      total: localItems.length,
      uniqueCount: sorted.length,
      topCategory: sorted[0],
      gaps: underrepresented,
    };
  }, [localItems]);

  const handleDelete = async (id: string) => {
    const item = localItems.find((entry) => entry.id === id);
    const itemName = item?.name || 'this item';

    if (!confirm(`Delete ${itemName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete item');
      }

      setLocalItems((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to delete item. Please try again.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track every item in your wardrobe and remove anything you no longer need.
          </p>
        </div>
        <Link
          href="/add-item"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Item
        </Link>
      </div>

      {categoryCoverage.total > 0 && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase text-indigo-500">Wardrobe coverage</p>
              <h2 className="text-lg font-semibold text-indigo-900">Spot potential gaps</h2>
              <p className="text-sm text-indigo-800">
                The product requirements call for gap analysis—this summary shows how evenly your wardrobe is
                spread across categories before you evaluate the next item.
              </p>
            </div>
            <div className="flex gap-6 text-sm text-indigo-900">
              <div>
                <p className="text-xs uppercase text-indigo-500">Items</p>
                <p className="text-2xl font-semibold">{categoryCoverage.total}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-indigo-500">Categories tracked</p>
                <p className="text-2xl font-semibold">{categoryCoverage.uniqueCount}</p>
              </div>
              {categoryCoverage.topCategory && (
                <div>
                  <p className="text-xs uppercase text-indigo-500">Most represented</p>
                  <p className="text-2xl font-semibold">
                    {categoryCoverage.topCategory.type} · {categoryCoverage.topCategory.count}
                  </p>
                </div>
              )}
            </div>
          </div>
          {categoryCoverage.gaps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase text-indigo-500">Underrepresented categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryCoverage.gaps.map((gap) => (
                  <span
                    key={gap.type}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-indigo-800 shadow-sm"
                  >
                    {gap.type} · {gap.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort by</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="date">Date added</option>
            <option value="name">Name</option>
            <option value="brand">Brand</option>
            <option value="type">Category</option>
          </select>
          <button
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            {sortDirection === 'asc' ? 'Asc ↑' : 'Desc ↓'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Category</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All</option>
            {categoryOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {brandOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Brand</label>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Search</label>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, brand, color…"
            className="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-1.5"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      )}

      {localItems.length === 0 ? (
        <div className="text-center border-2 border-dashed border-gray-200 rounded-lg py-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No items yet</h2>
          <p className="text-gray-600 mb-6">Add a few pieces to start managing your wardrobe.</p>
          <Link
            href="/add-item"
            className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add your first item
          </Link>
        </div>
      ) : !hasMatches ? (
        <div className="text-center border border-dashed border-gray-200 rounded-lg py-14">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No matches</h2>
          <p className="text-gray-600 text-sm max-w-xl mx-auto">
            Try adjusting the search, brand, or category filters to find the item you&apos;re looking
            for.
          </p>
          <button
            onClick={() => {
              setFilterType('all');
              setFilterBrand('all');
              setSearchTerm('');
              setSortKey('date');
              setSortDirection('desc');
            }}
            className="mt-4 inline-flex items-center rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedItems.map((item) => (
            <div key={item.id} className="group relative">
              <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <Link href={`/item/${item.id}`} className="block">
                  <div className="aspect-square relative">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                      {item.name}
                    </h3>
                    {item.brand && (
                      <p className="text-sm text-gray-500">{item.brand}</p>
                    )}
                    {item.price && item.price.amount != null && (
                      <p className="text-sm font-semibold text-gray-900">
                        {item.price.currency || 'USD'} {item.price.amount.toFixed(2)}
                      </p>
                    )}
                    <p className="text-gray-600 text-sm">
                      {item.type} • {item.color} • Size {item.size}
                    </p>
                    {item.material && (
                      <p className="text-gray-600 text-sm">Material: {item.material}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={`${item.id}-tag-${index}`}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                    {item.images && item.images.length > 1 && (
                      <p className="text-xs text-gray-500 mt-2">
                        {item.images.length} images available
                      </p>
                    )}
                  </div>
                </Link>
                {item.listingUrl && (
                  <div className="px-4 pb-4">
                    <a
                      href={item.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                    >
                      View listing ↗
                    </a>
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(item.id);
                }}
                disabled={deletingId === item.id}
                className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-600 shadow-sm transition hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                title="Delete item"
                aria-label="Delete item"
              >
                {deletingId === item.id ? (
                  <span className="text-xs font-semibold">…</span>
                ) : (
                  <span className="text-lg leading-none">&times;</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
