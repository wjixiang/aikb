import { Reference } from '@/lib/agents/agent.types';
import { concat_documents } from './rag_workflow';

// Test function to verify concat_documents implementation
function testConcatDocuments() {
  console.log('Testing concat_documents function...\n');

  // Test case 1: Basic continuous documents
  const testDocs1: Reference[] = [
    {
      title: 'Document 1',
      page_number: '1-2',
      score: 0.9,
      content: 'Content from pages 1-2',
      presigned_url: 'http://example.com/doc1',
    },
    {
      title: 'Document 2',
      page_number: '2-3',
      score: 0.8,
      content: 'Content from pages 2-3',
      presigned_url: 'http://example.com/doc2',
    },
    {
      title: 'Document 3',
      page_number: '4-5',
      score: 0.7,
      content: 'Content from pages 4-5',
      presigned_url: 'http://example.com/doc3',
    },
  ];

  console.log('Test Case 1: Basic continuous documents');
  console.log(
    'Input:',
    testDocs1.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  const result1 = concat_documents(testDocs1);
  console.log(
    'Output:',
    result1.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  console.log('Expected: Merged [1-2, 2-3] into [1-3], kept [4-5]\n');

  // Test case 2: Non-continuous documents
  const testDocs2: Reference[] = [
    {
      title: 'Document 1',
      page_number: '1-2',
      score: 0.9,
      content: 'Content from pages 1-2',
      presigned_url: 'http://example.com/doc1',
    },
    {
      title: 'Document 2',
      page_number: '5-6',
      score: 0.8,
      content: 'Content from pages 5-6',
      presigned_url: 'http://example.com/doc2',
    },
  ];

  console.log('Test Case 2: Non-continuous documents');
  console.log(
    'Input:',
    testDocs2.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  const result2 = concat_documents(testDocs2);
  console.log(
    'Output:',
    result2.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  console.log('Expected: No merging, keep separate\n');

  // Test case 3: Single page documents
  const testDocs3: Reference[] = [
    {
      title: 'Document 1',
      page_number: '1',
      score: 0.9,
      content: 'Content from page 1',
      presigned_url: 'http://example.com/doc1',
    },
    {
      title: 'Document 2',
      page_number: '2',
      score: 0.8,
      content: 'Content from page 2',
      presigned_url: 'http://example.com/doc2',
    },
    {
      title: 'Document 3',
      page_number: '3',
      score: 0.7,
      content: 'Content from page 3',
      presigned_url: 'http://example.com/doc3',
    },
  ];

  console.log('Test Case 3: Single page continuous documents');
  console.log(
    'Input:',
    testDocs3.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  const result3 = concat_documents(testDocs3);
  console.log(
    'Output:',
    result3.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  console.log('Expected: Merged [1,2,3] into [1-3]\n');

  // Test case 4: Mixed with documents without page numbers
  const testDocs4: Reference[] = [
    {
      title: 'Document 1',
      page_number: '1-2',
      score: 0.9,
      content: 'Content from pages 1-2',
      presigned_url: 'http://example.com/doc1',
    },
    {
      title: 'Document 2',
      page_number: '2-3',
      score: 0.8,
      content: 'Content from pages 2-3',
      presigned_url: 'http://example.com/doc2',
    },
    {
      title: 'Document 3',
      score: 0.7,
      content: 'Content without page number',
      presigned_url: 'http://example.com/doc3',
    },
  ];

  console.log('Test Case 4: Mixed with documents without page numbers');
  console.log(
    'Input:',
    testDocs4.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  const result4 = concat_documents(testDocs4);
  console.log(
    'Output:',
    result4.map((d: Reference) => ({ title: d.title, pages: d.page_number })),
  );
  console.log(
    'Expected: Merged [1-2,2-3] into [1-3], kept document without page number\n',
  );

  // Test case 5: Empty array
  console.log('Test Case 5: Empty array');
  const result5 = concat_documents([]);
  console.log('Output:', result5);
  console.log('Expected: []\n');
}

// Run the tests
testConcatDocuments();
