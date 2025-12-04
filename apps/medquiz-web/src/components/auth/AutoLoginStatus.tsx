'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Debug component to show auto-login status
 * This can be used for testing the auto-login functionality
 */
export function AutoLoginStatus() {
  const { data: session, status } = useSession();
  const [wasLoggedIn, setWasLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wasLoggedIn');
      setWasLoggedIn(stored === 'true');
    } catch (error) {
      setWasLoggedIn(null);
    }
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg text-sm">
      <h4 className="font-semibold mb-2">Auto-login Debug Info</h4>
      <div className="space-y-1">
        <div>
          Status: <span className="font-mono">{status}</span>
        </div>
        <div>
          Session:{' '}
          <span className="font-mono">{session ? 'Active' : 'None'}</span>
        </div>
        <div>
          Was logged in:{' '}
          <span className="font-mono">
            {wasLoggedIn === null ? 'Unknown' : wasLoggedIn.toString()}
          </span>
        </div>
      </div>
    </div>
  );
}
