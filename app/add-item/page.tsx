import AddItemClient from './AddItemClient';
import { prisma } from '../lib/prisma';
import { requireUser } from '../lib/auth';

type SearchParams = { edit?: string };

interface PageProps {
  searchParams?: SearchParams | Promise<SearchParams>;
}

const formatTags = (raw: string | null) => {
  if (!raw) return '';
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .join(', ');
};

const loadItemForEdit = async (id: string, userId: string) => {
  const item = await prisma.item.findFirst({ where: { id, userId } });
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
  const user = await requireUser();
  const resolvedSearchParams: SearchParams =
    searchParams && typeof (searchParams as Promise<SearchParams>).then === 'function'
      ? await (searchParams as Promise<SearchParams>)
      : searchParams ?? {};
  const editId = resolvedSearchParams?.edit ?? null;
  let initialItem = null;
  if (editId) {
    initialItem = await loadItemForEdit(editId, user.id);
  }

  return <AddItemClient editId={editId} initialItem={initialItem ?? undefined} />;
}
