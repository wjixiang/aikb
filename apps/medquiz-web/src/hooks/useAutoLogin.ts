'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

/**
 * Custom hook for automatic session restoration
 * Attempts to restore the session when the app loads if the user was previously logged in
 */
export function useAutoLogin() {
  const { data: session, status } = useSession();
  const hasAttemptedLogin = useRef(false);

  useEffect(() => {
    // Skip if already logged in or if we've already attempted auto-login
    if (status === 'authenticated' || hasAttemptedLogin.current) {
      return;
    }

    // Mark that we've attempted auto-login to prevent infinite loops
    hasAttemptedLogin.current = true;

    // Check if user was previously logged in (using localStorage)
    // Use try-catch to handle cases where localStorage might not be available (SSR)
    try {
      const wasLoggedIn = localStorage.getItem('wasLoggedIn');

      if (wasLoggedIn === 'true') {
        // Attempt to restore the session by checking the current session
        // The SessionProvider will handle the actual session restoration
        console.log('Attempting auto-login...');

        // The session check happens automatically through NextAuth
        // We just need to wait for the status to resolve
      }
    } catch (error) {
      console.warn('Could not access localStorage for auto-login:', error);
    }
  }, [status]);

  useEffect(() => {
    // Track login state changes
    try {
      if (status === 'authenticated' && session) {
        localStorage.setItem('wasLoggedIn', 'true');
      } else if (status === 'unauthenticated') {
        // Clear the flag when user is definitely logged out
        localStorage.removeItem('wasLoggedIn');
      }
    } catch (error) {
      console.warn('Could not update login state in localStorage:', error);
    }
  }, [session, status]);

  return { session, status };
}
