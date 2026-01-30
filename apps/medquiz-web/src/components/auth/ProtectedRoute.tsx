'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loading = status === 'loading';

  useEffect(() => {
    if (!loading && !session) {
      // Check if auto-login is still in progress
      const wasLoggedIn =
        typeof window !== 'undefined'
          ? localStorage.getItem('wasLoggedIn')
          : null;

      if (wasLoggedIn === 'true') {
        // Give a bit more time for auto-login to complete
        const timer = setTimeout(() => {
          if (!session) {
            router.push('/auth/signin');
          }
        }, 1000);

        return () => clearTimeout(timer);
      } else {
        router.push('/auth/signin');
      }
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  return session ? <>{children}</> : null;
}
