import React from 'react';
import { ChatInterface } from './components/ChatInterface/ChatInterface';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">MedAgent</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                AI Medical Assistant
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
}

export default App;
