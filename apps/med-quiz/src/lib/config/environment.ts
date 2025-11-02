/**
 * Environment configuration for production deployment
 * This file provides centralized environment configuration
 */

export const getBaseUrl = (): string => {
  // In production, use the actual deployed URL
  if (typeof window !== "undefined") {
    // Client-side: use current origin
    return window.location.origin;
  }

  // Server-side: check for production environment
  if (process.env.NODE_ENV === "production") {
    // Use production URL from environment or infer from request
    return process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
  }

  // Development
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
};

export const getApiUrl = (path: string = ""): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};
