/**
 * Authentication utilities for Next.js App Router
 * Server-side helpers using cookies
 */

import { cookies } from 'next/headers';
import { verifySession, createSession, type AuthUser } from './auth.service';

const COOKIE_NAME = 'token';

/**
 * Get current user from request cookies
 * Use in Server Components and Route Handlers
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

/**
 * Set session token in cookies
 * Call after successful login/registration
 */
export async function setSessionToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clear session token (logout)
 */
export async function clearSessionToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Require authentication - redirect to login if not authenticated
 * Use in Server Components
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// Re-export types
export type { AuthUser, JWTPayload } from './auth.service';
// Re-export service functions
export { createSession, verifySession, registerUser, loginUser, invalidateSession } from './auth.service';
