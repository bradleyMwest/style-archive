import { NextRequest } from 'next/server';
import { AuthenticatedUser, SESSION_COOKIE_NAME, authenticateRequest } from './auth';

export async function getRequestUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return authenticateRequest(token);
}
