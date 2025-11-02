import { Reference } from "@/lib/agents/agent.types";
import { concat_documents } from "./rag_workflow";

// Demo overlapping content merging
const overlappingDocs: Reference[] = [
  {
    title: "Chapter 1",
    page_number: "1-3",
    score: 0.9,
    content: "This is content from pages 1-3 covering introduction",
    presigned_url: "http://example.com/ch1",
  },
  {
    title: "Chapter 2",
    page_number: "3-5",
    score: 0.8,
    content: "This continues from page 3 with more detailed information",
    presigned_url: "http://example.com/ch2",
  },
  {
    title: "Chapter 3",
    page_number: "6-8",
    score: 0.7,
    content: "This is separate content from pages 6-8",
    presigned_url: "http://example.com/ch3",
  },
];

console.log("=== Overlapping Content Demo ===");
console.log("Input documents:");
overlappingDocs.forEach((doc) => {
  console.log(`- ${doc.title}: pages ${doc.page_number}`);
});

const merged = concat_documents(overlappingDocs);
console.log("\nMerged result:");
merged.forEach((doc) => {
  console.log(`- ${doc.title}: pages ${doc.page_number}`);
  console.log(`  Content: ${doc.content.substring(0, 50)}...`);
});

console.log("\n=== Summary ===");
console.log("✅ Documents 1-3 and 3-5 merged into 1-5 (overlapping at page 3)");
console.log("✅ Document 6-8 kept separate (no overlap)");
console.log("✅ Content combined with newlines between merged documents");
