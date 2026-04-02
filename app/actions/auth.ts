'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '../lib/prisma';
import {
  SESSION_COOKIE_NAME,
  createSession,
  deleteSession,
  getRedirectTarget,
} from '../lib/auth';
import { verifyPassword } from '../lib/passwords';

type FieldErrors = Record<string, string[]>;

export type AuthFormState = {
  errors?: FieldErrors;
  message?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value: string | null): string[] => {
  const trimmed = (value || '').trim();
  if (!trimmed) return ['Email is required.'];
  if (!emailPattern.test(trimmed)) return ['Please enter a valid email.'];
  return [];
};

const buildErrorState = (errors: FieldErrors, message?: string): AuthFormState => ({
  errors,
  message: message || null,
});

export async function login(prevState: AuthFormState | undefined, formData: FormData): Promise<AuthFormState | undefined> {
  const email = (formData.get('email') || '').toString().toLowerCase();
  const password = (formData.get('password') || '').toString();

  const errors: FieldErrors = {};
  const emailErrors = validateEmail(email);
  if (emailErrors.length) {
    errors.email = emailErrors;
  }

  if (!password) {
    errors.password = ['Password is required.'];
  }

  if (Object.keys(errors).length > 0) {
    return buildErrorState(errors);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return buildErrorState({}, 'Invalid email or password.');
  }

  await createSession(user.id);
  redirect(getRedirectTarget(formData));
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await deleteSession(token);
  redirect('/login');
}
