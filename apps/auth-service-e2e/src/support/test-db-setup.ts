import { config } from 'dotenv';

// Load test environment variables
config({ path: './apps/auth-service-e2e/.env.test' });

// Mock database for testing
export interface MockUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  phone?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordIterations?: number;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRefreshToken {
  id: string;
  token: string;
  userId: string;
  expires: Date;
  isRevoked: boolean;
  createdAt: Date;
}

export interface MockSession {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  lastActivity: Date;
  clientInfo?: any;
  isActive: boolean;
  createdAt: Date;
}

export interface MockLoginLog {
  id: string;
  userId: string;
  success: boolean;
  loginType: string;
  failureReason?: string;
  ip: string;
  userAgent?: string;
  createdAt: Date;
}

export interface MockPasswordHistory {
  id: string;
  userId: string;
  passwordHash: string;
  passwordSalt: string;
  iterations: number;
  createdAt: Date;
}

export interface MockEmailVerification {
  id: string;
  email: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface MockPasswordReset {
  id: string;
  email: string;
  token: string;
  userId: string;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory mock database
const mockDb = {
  users: new Map<string, MockUser>(),
  refreshTokens: new Map<string, MockRefreshToken>(),
  sessions: new Map<string, MockSession>(),
  loginLogs: new Map<string, MockLoginLog>(),
  passwordHistory: new Map<string, MockPasswordHistory>(),
  emailVerifications: new Map<string, MockEmailVerification>(),
  passwordResets: new Map<string, MockPasswordReset>(),
};

export function getMockDb() {
  return mockDb;
}

export function clearMockDb() {
  mockDb.users.clear();
  mockDb.refreshTokens.clear();
  mockDb.sessions.clear();
  mockDb.loginLogs.clear();
  mockDb.passwordHistory.clear();
  mockDb.emailVerifications.clear();
  mockDb.passwordResets.clear();
}

export function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export function generateToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export async function setupTestDatabase() {
  console.log('Setting up mock test database...');
  clearMockDb();
  console.log('Mock test database setup completed');
}

export async function cleanupTestDatabase() {
  console.log('Cleaning up mock test database...');
  clearMockDb();
  console.log('Mock test database cleanup completed');
}
