'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type WardrobeItem = {
  id: string;
  name: string;
  type: string;
  color: string;
  size: string;
  image: string;
  tags: string[];
};

interface CreateOutfitClientProps {
  items: WardrobeItem[];
}

const SLOT_DEFINITIONS = [
  { id: 'outerwear', label: 'Outerwear', filters: ['jacket', 'coat', 'outerwear', 'blazer'], allowMultiple: false },
  { id: 'top', label: 'Top Layers', filters: ['shirt', 'tee', 'sweater', 'hoodie', 'top'], allowMultiple: true },
  { id: 'bottom', label: 'Bottom', filters: ['pants', 'jean', 'short', 'skirt', 'bottom'], allowMultiple: false },
  { id: 'shoes', label: 'Shoes', filters: ['shoe', 'boot', 'sneaker'], allowMultiple: false },
] as const;

const ACCESSORY_KEYWORDS = ['accessory', 'bag', 'hat', 'watch', 'belt', 'sunglass'];

const normalize = (value: string) => value.toLowerCase();

export default function CreateOutfitClient({ items }: CreateOutfitClientProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slotSelections, setSlotSelections] = useState<Record<string, string[]>>(() => {
    return SLOT_DEFINITIONS.reduce((acc, slot) => ({ ...acc, [slot.id]: [] }), {} as Record<string, string[]>);
  });
  const [accessories, setAccessories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const optionsBySlot = useMemo(() => {
    return SLOT_DEFINITIONS.reduce((acc, slot) => {
      acc[slot.id] = items.filter((item) =>
        slot.filters.some((keyword) => normalize(item.type).includes(keyword))
      );
      if (acc[slot.id].length === 0) {
        acc[slot.id] = items;
      }
      return acc;
    }, {} as Record<string, WardrobeItem[]>);
  }, [items]);

  const accessoryOptions = useMemo(
    () =>
      items.filter((item) =>
        ACCESSORY_KEYWORDS.some((keyword) => normalize(item.type).includes(keyword))
      ),
    [items]
  );

  const selectedItems = useMemo(() => {
    const ids = new Set<string>();
    Object.values(slotSelections).forEach((values) => {
      values.forEach((value) => ids.add(value));
    });
    accessories.forEach((id) => ids.add(id));
    return items.filter((item) => ids.has(item.id));
  }, [slotSelections, accessories, items]);

  const handleSlotChange = (slotId: string, itemId: string) => {
    setSlotSelections((prev) => ({ ...prev, [slotId]: itemId ? [itemId] : [] }));
  };

  const toggleSlotLayer = (slotId: string, itemId: string) => {
    setSlotSelections((prev) => {
      const current = prev[slotId] ?? [];
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
      return { ...prev, [slotId]: next };
    });
  };

  const toggleAccessory = (itemId: string) => {
    setAccessories((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const chosen = Array.from(
      new Set([
        ...Object.values(slotSelections).flatMap((values) => values),
        ...accessories,
      ])
    );

    if (!name.trim()) {
      setError('Outfit name is required.');
      return;
    }

    if (chosen.length === 0) {
      setError('Select at least one item.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const response = await fetch('/api/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), itemIds: chosen }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save outfit.');
      }

      router.push('/outfits');
    } catch (submitError) {
      console.error('Unable to save outfit', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Failed to save outfit');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Outfit</h1>
          <p className="text-gray-600 text-sm">Mix and match pieces from your wardrobe.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {error && <div className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Outfit Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Weekend brunch fit"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Why this combo works, occasions, etc."
            />
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Outfit Slots</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SLOT_DEFINITIONS.map((slot) => {
              const selections = slotSelections[slot.id] ?? [];
              return (
                <div key={slot.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{slot.label}</h3>
                    <p className="text-xs text-gray-500">
                      {slot.allowMultiple ? 'Select one or more items' : 'Select one item'}
                    </p>
                  </div>
                  {selections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSlotSelections((prev) => ({ ...prev, [slot.id]: [] }))}
                      className="text-sm text-blue-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {slot.allowMultiple ? (
                  <>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {optionsBySlot[slot.id].map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={selections.includes(item.id)}
                            onChange={() => toggleSlotLayer(slot.id, item.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {item.name} • {item.color}
                        </label>
                      ))}
                    </div>
                    {selections.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selections.map((id) => (
                          <SelectedItemPreview key={id} item={items.find((itm) => itm.id === id)} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <select
                      value={selections[0] ?? ''}
                      onChange={(e) => handleSlotChange(slot.id, e.target.value)}
                      className="w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Choose {slot.label}</option>
                      {optionsBySlot[slot.id].map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} • {item.color}
                        </option>
                      ))}
                    </select>
                    {selections[0] && (
                      <SelectedItemPreview item={items.find((itm) => itm.id === selections[0])} />
                    )}
                  </>
                )}
              </div>
              );
            })}

            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Accessories</h3>
                  <p className="text-xs text-gray-500">Select multiple if desired</p>
                </div>
                {accessories.length > 0 && (
                  <button type="button" onClick={() => setAccessories([])} className="text-sm text-blue-600">
                    Clear
                  </button>
                )}
              </div>
              {accessoryOptions.length === 0 ? (
                <p className="text-sm text-gray-500">No accessories in wardrobe yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {accessoryOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={accessories.includes(item.id)}
                        onChange={() => toggleAccessory(item.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Selected Items</h2>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-500">Choose items to see a preview.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {selectedItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="relative aspect-square">
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {item.type} • {item.color}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/outfits')}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Outfit'}
          </button>
        </div>
      </form>

      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Wardrobe Inventory</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Add items to your wardrobe to start creating outfits.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="relative aspect-square">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {item.type} • {item.color}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedItemPreview({ item }: { item?: WardrobeItem }) {
  if (!item) return null;
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="relative w-12 h-12 rounded overflow-hidden border border-gray-200 bg-gray-50">
        <Image src={item.image} alt={item.name} fill className="object-cover" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{item.name}</p>
        <p className="text-xs text-gray-500 capitalize">
          {item.type} • {item.color}
        </p>
      </div>
    </div>
  );
}
