import { Reference } from '@/lib/agents/agent.types';
import { concat_documents } from './rag_workflow';

// Test specific case
const specificTest: Reference[] = [
  {
    title: 'Doc 1',
    page_number: '1-2',
    score: 0.9,
    content: 'Content 1-2',
    presigned_url: 'http://example.com/1',
  },
  {
    title: 'Doc 2',
    page_number: '2-3',
    score: 0.8,
    content: 'Content 2-3',
    presigned_url: 'http://example.com/2',
  },
  {
    title: 'Doc 3',
    page_number: '4-5',
    score: 0.7,
    content: 'Content 4-5',
    presigned_url: 'http://example.com/3',
  },
];

console.log('Testing specific case: 1-2, 2-3, 4-5');
console.log('Expected: Should merge 1-2 and 2-3 into 1-3, keep 4-5 separate');
const result = concat_documents(specificTest);
console.log(
  'Actual result:',
  result.map((d) => ({ title: d.title, pages: d.page_number })),
);

// Manual check
console.log('\nManual check:');
console.log(
  '2-3 and 4-5: 4 <= 3+1 =',
  4 <= 3 + 1,
  '(should be false to separate)',
);
console.log('1-2 and 2-3: 2 <= 2+1 =', 2 <= 2 + 1, '(should be true to merge)');
