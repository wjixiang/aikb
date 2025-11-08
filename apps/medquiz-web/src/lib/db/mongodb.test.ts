import { describe, it, expect, vi } from 'vitest';
import { connectToDatabase } from './mongodb';

// Mock the MongoDB module
// vi.mock("mongodb", () => ({
//   MongoClient: vi.fn().mockImplementation(() => ({
//     connect: vi.fn().mockResolvedValue(true),
//     db: vi.fn().mockReturnValue({
//       collection: vi.fn(),
//     }),
//   })),
//   Db: vi.fn(),
// }));

describe(connectToDatabase, () => {
  it.skip('connect to mongDB', async () => {
    const { db } = await connectToDatabase();
    expect(db).toBeDefined();
  }, 10000); // Increase timeout to 10 seconds
});
