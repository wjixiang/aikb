import { Reference } from "@/lib/agents/agent.types";
import { concat_documents } from "./rag_workflow";

// Test the actual concat_documents function
const debugDocs: Reference[] = [
  {
    title: "Document 1",
    page_number: "1-2",
    score: 0.9,
    content: "Content from pages 1-2",
    presigned_url: "http://example.com/doc1",
  },
  {
    title: "Document 2",
    page_number: "2-3",
    score: 0.8,
    content: "Content from pages 2-3",
    presigned_url: "http://example.com/doc2",
  },
];

console.log("Testing concat_documents with 1-2 and 2-3:");
console.log(
  "Input:",
  debugDocs.map((d) => ({ title: d.title, pages: d.page_number })),
);
const result = concat_documents(debugDocs);
console.log(
  "Output:",
  result.map((d) => ({ title: d.title, pages: d.page_number })),
);
console.log(
  "Content:",
  result.map((d) => d.content),
);
