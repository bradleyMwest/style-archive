import AddItemClient from './AddItemClient';
import { prisma } from '../lib/prisma';

interface PageProps {
  searchParams?: { edit?: string };
}

const formatTags = (raw: string | null) => {
  if (!raw) return '';
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .join(', ');
};

const loadItemForEdit = async (id: string) => {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return null;

  return {
    id: item.id,
    formValues: {
      name: item.name ?? '',
      type: item.type ?? '',
      color: item.color ?? '',
      size: item.size ?? '',
      image: item.image ?? '',
      tags: formatTags(item.tags ?? null),
      material: item.material ?? '',
      brand: item.brand ?? '',
      listingUrl: item.listingUrl ?? '',
      description: item.description ?? '',
      priceAmount: item.priceAmount != null ? String(item.priceAmount) : '',
      priceCurrency: item.priceCurrency ?? 'USD',
    },
  };
};

export default async function AddItemPage({ searchParams }: PageProps) {
  const editId = searchParams?.edit ?? null;
  let initialItem = null;
  if (editId) {
    initialItem = await loadItemForEdit(editId);
  }

  return <AddItemClient editId={editId} initialItem={initialItem ?? undefined} />;
}
