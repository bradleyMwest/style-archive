import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth';
import LoginForm from './LoginForm';

interface PageProps {
  searchParams?: Promise<{ next?: string }>;
}

const getRedirectTarget = async (searchParamsPromise?: Promise<{ next?: string }>) => {
  const searchParams = (await searchParamsPromise) ?? {};
  const next = searchParams.next;
  if (typeof next === 'string' && next.startsWith('/')) {
    return next;
  }
  return '/';
};

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  const redirectTo = await getRedirectTarget(searchParams);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-gray-50">
      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
