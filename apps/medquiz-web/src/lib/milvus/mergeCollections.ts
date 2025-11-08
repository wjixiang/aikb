#!/usr/bin/env ts-node
import { embeddings } from '../langchain/provider';
import milvusCollectionOperator from './milvusCollectionOperator';

export async function mergeCollection(): Promise<void> {
  // Parse command line arguments
  // const args = process.argv.slice(2);
  // if (args.length < 2) {
  //   console.error("Usage: mergeCollections.ts <targetCollection> <sourceCollection1> [sourceCollection2...]");
  //   process.exit(1);
  // }

  // const [targetCollection, ...sourceCollections] = args;
  const targetCollection = 'notebook';
  const sourceCollections = [
    'pathology',
    'surgery',
    'neurology',
    'infectious',
    'internal',
    'physiology',
  ];

  console.log(
    `Merging collections: ${sourceCollections.join(', ')} into ${targetCollection}`,
  );

  try {
    // Initialize operator with any collection name (we'll override it in mergeCollections)
    const operator = new milvusCollectionOperator(sourceCollections[0]);

    // Perform the merge
    await operator.mergeCollections(sourceCollections, targetCollection);

    console.log('Merge completed successfully');
  } catch (error) {
    console.error('Error merging collections:', error);
    process.exit(1);
  }
}
