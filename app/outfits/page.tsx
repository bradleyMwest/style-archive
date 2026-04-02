import OutfitsClient from './OutfitsClient';
import { requireUser } from '../lib/auth';

export default async function OutfitsPage() {
  await requireUser();
  return <OutfitsClient />;
}
