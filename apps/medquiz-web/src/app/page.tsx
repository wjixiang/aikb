'use client';
import { useState, useEffect } from 'react';
import QuizApp from '@/components/ai-coach/QuizApp';

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // 在组件挂载之前不输出 UI 内容
  if (!hasMounted) {
    return null;
  }

  return (
    <div className="h-full w-full">
      <QuizApp />
    </div>
  );
}
