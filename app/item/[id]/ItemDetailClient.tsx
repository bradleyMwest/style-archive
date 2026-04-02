'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

type ItemDetail = {
  id: string;
  name: string;
  type: string;
  color: string;
  size: string;
  material?: string;
  brand?: string;
  listingUrl?: string;
  dateAdded: string;
  description?: string;
  image: string;
  images: string[];
  tags: string[];
  price?: {
    amount?: number;
    currency?: string;
  };
};

interface ItemDetailClientProps {
  item: ItemDetail;
}

const formatTags = (tags: string[]) => tags.join(', ');
const parseTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const parseImagesInput = (value: string) =>
  value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const formatImagesInput = (images: string[]) => images.join('\n');

const normalizePriceAmount = (value: number | undefined) =>
  typeof value === 'number' && !Number.isNaN(value) ? value.toString() : '';

export default function ItemDetailClient({ item }: ItemDetailClientProps) {
  const [viewItem, setViewItem] = useState(item);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    name: item.name,
    brand: item.brand || '',
    type: item.type,
    color: item.color,
    size: item.size,
    material: item.material || '',
    description: item.description || '',
    listingUrl: item.listingUrl || '',
    image: item.image,
    imagesInput: formatImagesInput(item.images),
    tagsInput: formatTags(item.tags),
    priceAmount: normalizePriceAmount(item.price?.amount),
    priceCurrency: item.price?.currency || 'USD',
  }));

  const resetForm = () => {
    setForm({
      name: viewItem.name,
      brand: viewItem.brand || '',
      type: viewItem.type,
      color: viewItem.color,
      size: viewItem.size,
      material: viewItem.material || '',
      description: viewItem.description || '',
      listingUrl: viewItem.listingUrl || '',
      image: viewItem.image,
      imagesInput: formatImagesInput(viewItem.images),
      tagsInput: formatTags(viewItem.tags),
      priceAmount: normalizePriceAmount(viewItem.price?.amount),
      priceCurrency: viewItem.price?.currency || 'USD',
    });
  };

  const toggleEditing = () => {
    if (isEditing) {
      resetForm();
      setError(null);
      setSuccess(null);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const tags = parseTags(form.tagsInput);
      const galleryImages = parseImagesInput(form.imagesInput);
      const priceAmountValue = form.priceAmount.trim().length > 0 ? Number(form.priceAmount) : undefined;

      const payload = {
        name: form.name,
        type: form.type,
        color: form.color,
        size: form.size,
        image: form.image,
        tags,
        images: galleryImages,
        material: form.material || undefined,
        brand: form.brand || undefined,
        description: form.description || undefined,
        listingUrl: form.listingUrl || undefined,
        priceAmount: priceAmountValue,
        priceCurrency: form.priceCurrency.trim() || undefined,
      };

      const response = await fetch(`/api/items/${viewItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      const updated = await response.json();
      let parsedImages: string[] = [];
      try {
        parsedImages = updated.images ? JSON.parse(updated.images) : [];
      } catch {
        parsedImages = viewItem.images;
      }
      const parsedTags =
        typeof updated.tags === 'string'
          ? updated.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
          : viewItem.tags;
      const updatedView: ItemDetail = {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        color: updated.color,
        size: updated.size,
        material: updated.material || undefined,
        brand: updated.brand || undefined,
        listingUrl: updated.listingUrl || undefined,
        dateAdded: updated.dateAdded,
        description: updated.description || undefined,
        image: updated.image,
        images: parsedImages,
        tags: parsedTags,
        price:
          updated.priceAmount != null
            ? { amount: Number(updated.priceAmount), currency: updated.priceCurrency || undefined }
            : undefined,
      };

      setViewItem(updatedView);
      setForm({
        name: updatedView.name,
        brand: updatedView.brand || '',
        type: updatedView.type,
        color: updatedView.color,
        size: updatedView.size,
        material: updatedView.material || '',
        description: updatedView.description || '',
        listingUrl: updatedView.listingUrl || '',
        image: updatedView.image,
        imagesInput: formatImagesInput(updatedView.images),
        tagsInput: formatTags(updatedView.tags),
        priceAmount: normalizePriceAmount(updatedView.price?.amount),
        priceCurrency: updatedView.price?.currency || 'USD',
      });
      setSuccess('Saved successfully');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  };

  const renderText = (value?: string) => value || '—';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/inventory" className="text-blue-600 hover:text-blue-800 flex items-center">
          ← Back to Inventory
        </Link>
        <button
          onClick={toggleEditing}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {isEditing ? 'Cancel' : 'Edit Item'}
        </button>
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <Image
              src={isEditing ? form.image || viewItem.image : viewItem.image}
              alt={viewItem.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
          {isEditing && (
            <div>
              <label className="text-sm font-medium text-gray-700">Hero Image URL</label>
              <input
                type="url"
                name="image"
                value={form.image}
                onChange={handleChange}
                className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://example.com/hero.jpg"
              />
            </div>
          )}

          {viewItem.images && viewItem.images.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Gallery</h3>
              <div className="grid grid-cols-4 gap-2">
                {viewItem.images.slice(0, 8).map((imageUrl, index) => (
                  <div key={index} className="aspect-square relative rounded-lg overflow-hidden">
                    <Image
                      src={imageUrl}
                      alt={`${viewItem.name} view ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 25vw, 12.5vw"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div>
              <label className="text-sm font-medium text-gray-700">Gallery Image URLs</label>
              <textarea
                name="imagesInput"
                value={form.imagesInput}
                onChange={handleChange}
                rows={4}
                className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={'One URL per line'}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Brand</label>
                  <input
                    type="text"
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900">{viewItem.name}</h1>
                {viewItem.brand && <p className="text-lg text-gray-600 mt-1">by {viewItem.brand}</p>}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {['type', 'color', 'size', 'material'].map((field) => (
              <div key={field}>
                <h3 className="text-sm font-medium text-gray-500 capitalize">{field}</h3>
                {isEditing ? (
                  <input
                    type="text"
                    name={field}
                    value={(form as Record<string, string>)[field] || ''}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg text-gray-900">
                    {renderText((viewItem as Record<string, string | undefined>)[field])}
                  </p>
                )}
              </div>
            ))}
            <div>
              <h3 className="text-sm font-medium text-gray-500">Price</h3>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="priceAmount"
                    value={form.priceAmount}
                    onChange={handleChange}
                    className="mt-1 flex-1 rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    step="0.01"
                  />
                  <input
                    type="text"
                    name="priceCurrency"
                    value={form.priceCurrency}
                    onChange={handleChange}
                    className="mt-1 w-24 rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    maxLength={3}
                  />
                </div>
              ) : viewItem.price?.amount != null ? (
                <p className="text-lg text-gray-900">
                  {viewItem.price.currency || 'USD'} {viewItem.price.amount.toFixed(2)}
                </p>
              ) : (
                <p className="text-lg text-gray-900">—</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
            {isEditing ? (
              <input
                type="text"
                name="tagsInput"
                value={form.tagsInput}
                onChange={handleChange}
                className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="casual, summer"
              />
            ) : viewItem.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {viewItem.tags.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No tags</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
            {isEditing ? (
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                {renderText(viewItem.description)}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Listing</h3>
            {isEditing ? (
              <input
                type="url"
                name="listingUrl"
                value={form.listingUrl}
                onChange={handleChange}
                className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://example.com/product"
              />
            ) : viewItem.listingUrl ? (
              <a
                href={viewItem.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center"
              >
                View original product ↗
              </a>
            ) : (
              <p className="text-gray-500">No listing URL</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Date Added</h3>
            <p className="text-lg text-gray-900">
              {new Date(viewItem.dateAdded).toLocaleDateString()}
            </p>
          </div>

          {isEditing && (
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={toggleEditing}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
