'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ProductImportDraft } from '../lib/importer/types';

type FormState = {
  name: string;
  type: string;
  color: string;
  size: string;
  image: string;
  tags: string;
  material: string;
  brand: string;
  listingUrl: string;
  description: string;
  priceAmount: string;
  priceCurrency: string;
};

const initialFormState: FormState = {
  name: '',
  type: '',
  color: '',
  size: '',
  image: '',
  tags: '',
  material: '',
  brand: '',
  listingUrl: '',
  description: '',
  priceAmount: '',
  priceCurrency: 'USD',
};

interface PrefilledItem {
  id: string;
  formValues: FormState;
}

interface AddItemClientProps {
  editId: string | null;
  initialItem?: PrefilledItem;
}

type AnalysisInputType = 'url' | 'description' | 'listing' | 'photo';

export default function AddItemClient({ editId, initialItem }: AddItemClientProps) {
  const router = useRouter();
  const isEditing = Boolean(editId);
  const [formData, setFormData] = useState<FormState>(() =>
    initialItem ? { ...initialItem.formValues } : { ...initialFormState }
  );
  const [inputType, setInputType] = useState<AnalysisInputType>('listing');
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState<ProductImportDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoMode, setPhotoMode] = useState<'idle' | 'capturing' | 'reviewing'>('idle');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const applyImportedDraft = (draft: ProductImportDraft, fallbackUrl: string) => {
    setFormData((prev) => {
      const next = { ...prev };
      next.name = prev.name || draft.title || '';
      next.brand = prev.brand || draft.brand || '';
      next.color = prev.color || draft.color || '';
      next.listingUrl = draft.url || fallbackUrl || prev.listingUrl;
      next.description = draft.description || prev.description;
      if (draft.price?.amount && !prev.priceAmount) {
        next.priceAmount = String(draft.price.amount);
      }
      if (draft.price?.currency && !prev.priceCurrency) {
        next.priceCurrency = draft.price.currency;
      }
      const heroImage = draft.images?.[0];
      if (!next.image && heroImage) {
        next.image = heroImage;
      }
      return next;
    });
  };

  useEffect(() => {
    if (initialItem) {
      setFormData({ ...initialItem.formValues });
    } else if (!isEditing) {
      setFormData({ ...initialFormState });
    }
  }, [initialItem, isEditing]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const attachStreamToVideo = async (stream: MediaStream) => {
    const node = videoRef.current;
    if (!node) return;
    node.srcObject = stream;
    node.muted = true;
    node.playsInline = true;
    const play = async () => {
      try {
        await node.play();
      } catch (error) {
        console.warn('Camera preview play() failed', error);
      }
    };
    if (node.readyState >= 2) {
      await play();
    } else {
      node.onloadedmetadata = () => {
        node.onloadedmetadata = null;
        void play();
      };
    }
  };

  const startCamera = async () => {
    if (photoMode === 'capturing') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhotoError('Camera access is not supported in this browser.');
      return;
    }
    setPhotoError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      await attachStreamToVideo(stream);
      streamRef.current = stream;
      setPhotoMode('capturing');
    } catch (error) {
      console.error('Camera access rejected', error);
      setPhotoError('Camera access was denied. Grant access or upload a photo manually.');
    }
  };

  useEffect(() => {
    if (photoMode === 'capturing' && streamRef.current) {
      void attachStreamToVideo(streamRef.current);
    }
  }, [photoMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setPhotoMode('idle');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    const MAX_DIMENSION = 1280;
    const largestSide = Math.max(video.videoWidth, video.videoHeight);
    const scale = largestSide > MAX_DIMENSION ? MAX_DIMENSION / largestSide : 1;

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    setFormData((prev) => ({ ...prev, image: dataUrl }));
    setPhotoError(null);
    setPhotoMode('reviewing');
    stopCamera();
  };

  const clearCapturedPhoto = () => {
    setFormData((prev) => ({
      ...prev,
      image: prev.image === capturedPhoto ? '' : prev.image,
    }));
    setCapturedPhoto('');
    setPhotoMode('idle');
  };

  const retakePhoto = () => {
    clearCapturedPhoto();
    void startCamera();
  };

  const importProduct = async () => {
    const trimmed = importUrl.trim();
    if (!trimmed) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch('/api/import-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!response.ok) {
        throw new Error('Import request failed');
      }

      const draft: ProductImportDraft = await response.json();
      setImportDraft(draft);
      applyImportedDraft(draft, trimmed);
    } catch (error) {
      console.error('Product import failed:', error);
      setImportError('Unable to import metadata from that URL. Please check the link or enter details manually.');
    } finally {
      setIsImporting(false);
    }
  };

  const analyzeItem = async (
    overrideInput?: string,
    overrideType?: AnalysisInputType,
  ) => {
    const sourceValue = overrideInput ?? input;
    const trimmedInput = sourceValue.trim();
    if (!trimmedInput) return;

    const resolvedType = overrideType ?? inputType;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: trimmedInput, type: resolvedType }),
      });

      if (response.ok) {
        const metadata = await response.json();
        const normalizedTags = Array.isArray(metadata.tags)
          ? metadata.tags
          : typeof metadata.tags === 'string'
            ? metadata.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
            : [];
        setFormData((prev) => ({
          ...prev,
          name: metadata.name || prev.name,
          type: metadata.type || prev.type,
          color: metadata.color || prev.color,
          size: metadata.size || prev.size,
          image: prev.image,
          tags: normalizedTags.length ? normalizedTags.join(', ') : prev.tags,
          material: metadata.material || prev.material,
          brand: metadata.brand || prev.brand,
          description: metadata.description || prev.description,
          priceAmount:
            typeof metadata.price?.amount === 'number' && !Number.isNaN(metadata.price.amount)
              ? String(metadata.price.amount)
              : prev.priceAmount,
          priceCurrency: metadata.price?.currency || prev.priceCurrency,
          listingUrl:
            metadata.listingUrl ||
            (resolvedType === 'listing' ? trimmedInput : prev.listingUrl),
        }));
      } else {
        alert('Failed to analyze item. Please fill in the details manually.');
      }
    } catch (error) {
      console.error('Error analyzing item:', error);
      alert('Error analyzing item. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && !editId && !initialItem?.id) {
      return;
    }
    const tagsArray = formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const payload = {
      name: formData.name,
      type: formData.type,
      color: formData.color,
      size: formData.size,
      image: formData.image,
      tags: tagsArray,
      material: formData.material || undefined,
      brand: formData.brand || undefined,
      description: formData.description || undefined,
      listingUrl: formData.listingUrl.trim() || undefined,
      priceAmount:
        formData.priceAmount.trim().length > 0 ? Number.parseFloat(formData.priceAmount) : undefined,
      priceCurrency: formData.priceCurrency.trim() || undefined,
    };

    const endpoint = isEditing && targetEditId ? `/api/items/${targetEditId}` : '/api/items';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      setIsSubmitting(true);
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      router.push('/inventory');
    } catch (error) {
      console.error('Save item error:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const targetEditId = editId || initialItem?.id || null;
  const headingTitle = isEditing ? 'Edit Item' : 'Add New Item';
  const submitButtonLabel = isSubmitting
    ? isEditing
      ? 'Saving...'
      : 'Adding...'
    : isEditing
      ? 'Save Changes'
      : 'Add Item';
  const isSubmitDisabled = isSubmitting || (isEditing && !targetEditId);

  const missingInitialItem = isEditing && !initialItem;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{headingTitle}</h1>
      {isEditing && (
        <p className="text-sm text-gray-600 mb-4">
          You&apos;re editing an existing item. Update any fields below and save when you&apos;re done.
        </p>
      )}
      {missingInitialItem && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load that item. Double-check the link or create a new item below.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-lg">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Product URL Importer</h2>
            <p className="text-sm text-gray-700">
              Paste a retail product URL to autofill as many fields as possible. The scraper runs on the server,
              so your browser never contacts the retailer directly.
            </p>
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-3">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://store.example.com/products/..."
              className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={importProduct}
              disabled={isImporting || !importUrl.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? 'Importing...' : 'Import URL'}
            </button>
          </div>
          {importError && <p className="text-sm text-red-600 mt-2">{importError}</p>}
          {importDraft && (
            <div className="mt-4 bg-white/70 border border-blue-200 rounded-md p-4 text-sm text-gray-700 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{importDraft.title || 'Imported product draft'}</p>
                  <p className="text-xs uppercase tracking-wide text-blue-700">Best-effort autofill</p>
                </div>
                {importDraft.price?.text && (
                  <span className="text-base font-semibold text-gray-900">{importDraft.price.text}</span>
                )}
              </div>
              {importDraft.brand && (
                <p>
                  <span className="font-medium text-gray-900">Brand:</span> {importDraft.brand}
                </p>
              )}
              {importDraft.color && (
                <p>
                  <span className="font-medium text-gray-900">Color:</span> {importDraft.color}
                </p>
              )}
              {importDraft.description && (
                <p className="text-xs text-gray-600">{importDraft.description}</p>
              )}
              {importDraft.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {importDraft.images.slice(0, 3).map((src) => (
                    <Image
                      key={src}
                      src={src}
                      alt="Imported preview"
                      width={64}
                      height={64}
                      className="w-16 h-16 object-cover rounded border border-blue-100"
                    />
                  ))}
                </div>
              )}
              {importDraft.warnings.length > 0 && (
                <ul className="text-xs text-amber-700 list-disc pl-4">
                  {importDraft.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-500">Review and edit any fields below before saving.</p>
            </div>
          )}
        </div>

        <div className="bg-purple-50 border border-purple-100 p-6 rounded-lg">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Quick Photo Capture</h2>
            <p className="text-sm text-gray-700">
              Snap your own clothing to populate the hero image and send the photo through AI for a reverse image analysis.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startCamera}
              disabled={photoMode === 'capturing'}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {photoMode === 'capturing' ? 'Camera Live' : 'Start Camera'}
            </button>
            {photoMode === 'capturing' && (
              <button
                type="button"
                onClick={stopCamera}
                className="text-sm text-purple-800 hover:text-purple-900 underline"
              >
                Stop Preview
              </button>
            )}
            {capturedPhoto && (
              <button
                type="button"
                onClick={retakePhoto}
                className="text-sm text-purple-800 hover:text-purple-900 underline"
              >
                Retake Photo
              </button>
            )}
          </div>
          {photoError && <p className="text-sm text-red-600 mt-2">{photoError}</p>}

          <div className="mt-4 border border-dashed border-purple-300 rounded-md overflow-hidden bg-black/80 min-h-[16rem] flex items-center justify-center">
            {photoMode === 'capturing' ? (
              <video
                ref={videoRef}
                className="w-full h-64 object-cover"
                muted
                playsInline
                autoPlay
              />
            ) : capturedPhoto ? (
              <Image
                src={capturedPhoto}
                alt="Captured preview"
                width={640}
                height={640}
                unoptimized
                className="w-full h-64 object-contain bg-black"
              />
            ) : (
              <p className="text-sm text-purple-100 px-4 text-center">
                Start the camera to frame your garment, then capture a still for this inventory item.
              </p>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {photoMode === 'capturing' && (
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Capture Photo
              </button>
            </div>
          )}
          {capturedPhoto && (
            <div className="mt-4 bg-white/70 border border-purple-200 rounded-md p-4 text-sm text-gray-700 space-y-3">
              <p className="font-medium text-gray-900">Photo saved to the form</p>
              <p>This snapshot now fills the Image URL field below so it uploads with your item.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={clearCapturedPhoto}
                  className="text-purple-700 hover:text-purple-900"
                >
                  Remove Photo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">AI-Powered Analysis</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="description"
                  checked={inputType === 'description'}
                  onChange={(e) => setInputType(e.target.value as AnalysisInputType)}
                  className="mr-2"
                />
                Text Description
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="url"
                  checked={inputType === 'url'}
                  onChange={(e) => setInputType(e.target.value as AnalysisInputType)}
                  className="mr-2"
                />
                Image URL
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="listing"
                  checked={inputType === 'listing'}
                  onChange={(e) => setInputType(e.target.value as AnalysisInputType)}
                  className="mr-2"
                />
                Listing URL
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {inputType === 'url' ? 'Image URL' : inputType === 'listing' ? 'Listing URL' : 'Item Description'}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                inputType === 'url' 
                  ? 'https://example.com/clothing-image.jpg' 
                  : inputType === 'listing' 
                    ? 'https://www.mrporter.com/...'
                    : 'Describe the clothing item (e.g., "blue cotton t-shirt with short sleeves")'
              }
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <button
            type="button"
            onClick={() => analyzeItem()}
            disabled={isAnalyzing || !input.trim()}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select type</option>
            <option value="shirt">Shirt</option>
            <option value="pants">Pants</option>
            <option value="shoes">Shoes</option>
            <option value="jacket">Jacket</option>
            <option value="dress">Dress</option>
            <option value="accessory">Accessory</option>
          </select>
        </div>
        <div>
          <label htmlFor="color" className="block text-sm font-medium text-gray-700">
            Color
          </label>
          <input
            type="text"
            id="color"
            name="color"
            required
            value={formData.color}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="size" className="block text-sm font-medium text-gray-700">
            Size
          </label>
          <input
            type="text"
            id="size"
            name="size"
            required
            value={formData.size}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700">
            Image URL or Captured Photo
          </label>
          <input
            type="url"
            id="image"
            name="image"
            required
            value={formData.image}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/image.jpg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Paste a product image URL or rely on the camera capture above (we already filled this when you snapped a photo).
          </p>
          {formData.image && (
            <div className="mt-3 border rounded-md overflow-hidden">
              <Image
                src={formData.image}
                alt="Item preview"
                width={480}
                height={480}
                unoptimized={formData.image.startsWith('data:image')}
                className="w-full max-h-80 object-contain bg-gray-50"
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="listingUrl" className="block text-sm font-medium text-gray-700">
            Product Listing URL
          </label>
          <input
            type="url"
            id="listingUrl"
            name="listingUrl"
            value={formData.listingUrl}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://www.mrporter.com/..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Store the source URL so you can revisit the original product page later.
          </p>
        </div>
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags (comma separated)
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="casual, summer, etc."
          />
        </div>
        <div>
          <label htmlFor="material" className="block text-sm font-medium text-gray-700">
            Material
          </label>
          <input
            type="text"
            id="material"
            name="material"
            value={formData.material}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="cotton, wool, polyester, etc."
          />
        </div>
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
            Brand
          </label>
          <input
            type="text"
            id="brand"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nike, Levi's, etc."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="priceAmount" className="block text-sm font-medium text-gray-700">
              Price Amount
            </label>
            <input
              type="number"
              id="priceAmount"
              name="priceAmount"
              value={formData.priceAmount}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 129.99"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label htmlFor="priceCurrency" className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <input
              type="text"
              id="priceCurrency"
              name="priceCurrency"
              value={formData.priceCurrency}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="USD"
              maxLength={3}
            />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any notes or paste the product description"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitButtonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
