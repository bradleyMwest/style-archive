import { prisma } from '../../lib/prisma';
import { buildCachedHeroImage } from '../../lib/hero-image';
import CreateOutfitClient from './CreateOutfitClient';
import { requireUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

const normalizeItem = (item: Awaited<ReturnType<typeof prisma.item.findFirst>>) => ({
  id: item!.id,
  name: item!.name,
  type: item!.type,
  color: item!.color,
  size: item!.size,
  image: buildCachedHeroImage({
    data: item!.heroImageData,
    mimeType: item!.heroImageMimeType,
    fallbackUrl: item!.image,
  }),
  tags: item!.tags ? item!.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
});

export default async function CreateOutfitPage() {
  const user = await requireUser();
  const items = await prisma.item.findMany({
    where: { userId: user.id },
    orderBy: { dateAdded: 'desc' },
  });

  const formatted = items.map((item) => normalizeItem(item));

  return <CreateOutfitClient items={formatted} />;
}
