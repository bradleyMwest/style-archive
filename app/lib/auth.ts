import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';

export const SESSION_COOKIE_NAME = 'style-archive-session';
const SESSION_DURATION_DAYS = 30;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const buildExpiry = () => new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

const serializeUser = (user: { id: string; email: string; name: string | null; role: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

export async function createSession(userId: string) {
  const rawToken = randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = buildExpiry();

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function deleteSession(token: string | undefined) {
  if (!token) {
    return;
  }

  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getUserFromSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return serializeUser(session.user);
}

export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromSessionToken(token);
  return user;
});

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (user) {
    return user;
  }

  const headerStore = await headers();
  const fallbackPath = headerStore.get('x-pathname') || headerStore.get('next-url') || '/';
  const redirectTo = fallbackPath && fallbackPath !== '/login' ? `?next=${encodeURIComponent(fallbackPath)}` : '';
  redirect(`/login${redirectTo}`);
}

export function getRedirectTarget(formData: FormData | URLSearchParams | undefined): string {
  if (!formData) return '/';
  const nextParam =
    formData instanceof URLSearchParams ? formData.get('next') : (formData.get('next') ?? formData.get('redirectTo'));
  if (!nextParam || typeof nextParam !== 'string') {
    return '/';
  }
  try {
    const url = new URL(nextParam, 'https://example.org');
    return url.pathname + url.search + url.hash;
  } catch {
    return nextParam.startsWith('/') ? nextParam : '/';
  }
}

export async function authenticateRequest(
  cookieValue: string | undefined | null
): Promise<AuthenticatedUser | null> {
  return getUserFromSessionToken(cookieValue);
}
