'use client';

import { SessionProvider } from 'next-auth/react';
import { useAutoLogin } from '@/hooks/useAutoLogin';

function AutoLoginHandler() {
  // Initialize auto-login functionality inside SessionProvider
  useAutoLogin();
  return null;
}

export function AuthProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AutoLoginHandler />
      {children}
    </SessionProvider>
  );
}
