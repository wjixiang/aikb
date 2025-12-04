'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';

interface CoTDisplayProps {
  cotMessages: string[];
  speechQueue: string[];
  isSpeaking: boolean;
}

export const CoTDisplay: React.FC<CoTDisplayProps> = ({
  cotMessages,
  speechQueue,
  isSpeaking,
}) => {
  const fullCoT = cotMessages.join('');

  return (
    <div className="space-y-4">
      {/* CoT Display */}
      {fullCoT && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
            <Volume2 className="w-4 h-4 mr-2" />
            思考过程
          </h3>
          <div className="text-sm text-blue-700 whitespace-pre-wrap">
            {fullCoT}
          </div>
        </Card>
      )}

      {/* Speech Queue Display */}
      {speechQueue.length > 0 && (
        <Card className="p-4 bg-green-50 border-green-200">
          <h3 className="text-sm font-semibold text-green-800 mb-2">
            语音队列 ({speechQueue.length} 条)
          </h3>
          <div className="text-xs text-green-600 space-y-1">
            {speechQueue.slice(-3).map((text, index) => (
              <div key={index} className="truncate">
                {text}
              </div>
            ))}
          </div>
          {isSpeaking && (
            <div className="text-xs text-green-700 mt-2 animate-pulse">
              正在播放...
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
