'use client';

import { useState } from 'react';

export default function PDFViewerPage() {
  const [pdfUrl, setPdfUrl] = useState('');

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PDF Viewer Demo</h1>

      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          PDF Viewer component has been temporarily disabled due to
          compatibility issues. Please use an external PDF viewer or download
          the PDF to view it.
        </p>
      </div>

      <div className="mb-4">
        <label className="block mb-2">PDF URL:</label>
        <input
          type="text"
          value={pdfUrl}
          onChange={(e) => setPdfUrl(e.target.value)}
          placeholder="Enter PDF URL"
          className="w-full p-2 border rounded"
        />
      </div>

      {pdfUrl && (
        <div className="mt-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="text-gray-700 mb-2">PDF URL: {pdfUrl}</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Open PDF in New Tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
