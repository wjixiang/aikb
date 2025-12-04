'use client';

import PracticeRecordBrowser from '@/components/quiz/PracticeRecordBrowser';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function QuizHistoryPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading user session...</div>;
  }

  if (!session || !session.user || !session.user.email) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view your practice history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Practice History</h1>
      <PracticeRecordBrowser />
    </div>
  );
}
