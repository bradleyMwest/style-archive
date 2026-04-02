import { requireUser } from '../lib/auth';
import ShopClient from './ShopClient';

export default async function ShopPage() {
  await requireUser();
  return <ShopClient />;
}
