'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { login, type AuthFormState } from '../actions/auth';

const initialState: AuthFormState = { message: null };

export default function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(login, initialState);
  return (
    <form
      action={formAction}
      className="bg-white shadow-sm border border-gray-100 rounded-lg p-8 space-y-6 max-w-md w-full"
    >
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="text-sm text-gray-500 mt-1">
          Access is limited to the two Style Archive test accounts. Ask the admin if you need
          credentials.
        </p>
      </div>

      {state?.message && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email.join(' ')}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {state?.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password.join(' ')}</p>
        )}
      </div>

      <input type="hidden" name="next" value={redirectTo ?? '/'} />

      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {pending ? 'Please wait…' : children}
    </button>
  );
}
