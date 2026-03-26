/**
 * Authentication Service for BibMax
 *
 * Provides JWT-based authentication with session management.
 * Compatible with both Next.js App Router and NestJS.
 */

import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../prisma';
import type { User, Session } from '../generated/prisma';

export interface JWTPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser extends Omit<User, 'passwordHash'> {}

export interface SessionWithUser extends Session {
  user: User;
}

// JWT Configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const JWT_ALGORITHM = 'HS256';
const SESSION_EXPIRY_DAYS = 7;

/**
 * Create a new session for a user
 * Generates JWT token and stores in database
 */
export async function createSession(
  userId: string,
  options?: { expiresIn?: number }
): Promise<string> {
  const expiresIn = options?.expiresIn || SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresIn);

  // Generate JWT token
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(JWT_SECRET);

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify a session token
 * Returns the user if valid, null otherwise
 */
export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Check session exists in database and is not expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      return null;
    }

    // Update last used time (optional, for analytics)
    return session.user as AuthUser;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { token } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId },
  });
  return result.count;
}

/**
 * Clean up expired sessions
 * Can be run periodically (e.g., cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Register a new user
 * Returns the created user (without password hash)
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthUser> {
  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      libraries: {
        create: {
          name: 'My Library',
          isDefault: true,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as AuthUser;
}

/**
 * Authenticate user with email and password
 * Returns JWT token if successful, null otherwise
 */
export async function loginUser(
  email: string,
  password: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return createSession(user.id);
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return false;
  }

  const isValid = await verifyPassword(oldPassword, user.passwordHash);
  if (!isValid) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Invalidate all sessions for security
  await invalidateAllUserSessions(userId);

  return true;
}

// ============ Password Helpers ============

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
