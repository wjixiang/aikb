'use client';
import { useState } from 'react';

export default function MCPTestPage() {
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('note');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;

    setLoading(true);
    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'user', content: query }],
          sessionId: 'test-session',
          tool_choice: 'notebook_retriever',
          tools: [
            {
              type: 'function',
              function: {
                name: 'notebook_retriever',
                parameters: {
                  query,
                  notebookCollectionName: collection,
                  maxK: 5,
                },
              },
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.tool_results) {
        const parsedResults = data.tool_results.map((tr: any) =>
          JSON.parse(tr.output),
        );
        console.log('Full retrieval results:', parsedResults);
        setResults(parsedResults);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Notebook Retriever Test</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your query"
          className="flex-1 p-2 border rounded"
        />
        <input
          type="text"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          placeholder="Collection name"
          className="w-40 p-2 border rounded"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Results</h2>
          {results.map((result, i) => (
            <div key={i} className="p-4 border rounded bg-gray-50">
              <h3 className="font-medium">
                Document {i + 1} (Score:{' '}
                {result.documents[0]?.score?.toFixed(2) || 'N/A'})
              </h3>
              <p className="mt-2 text-gray-700">
                {result.documents[0]?.content}
              </p>
              <pre className="mt-2 text-xs text-gray-500 overflow-auto">
                {JSON.stringify(result.documents[0]?.metadata, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
