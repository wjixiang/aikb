import { GET, POST } from '../route';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/authOptions';

// Mock dependencies
jest.mock('@/lib/db/mongodb');
jest.mock('next-auth');
jest.mock('@/lib/auth/authOptions');
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

describe('User Tags API', () => {
  const mockDb = {
    collection: jest.fn(),
  };

  const mockSession = {
    user: {
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (connectToDatabase as jest.Mock).mockResolvedValue({ db: mockDb });
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (NextResponse.json as jest.Mock).mockImplementation((data) => data);
  });

  describe('GET /api/user/tags', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/user/tags');
      const response = await GET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    });

    it('should return user tags with counts', async () => {
      const mockTags = [
        { _id: { value: 'anatomy', type: 'subject' }, count: 5 },
        { _id: { value: 'physiology', type: 'subject' }, count: 3 },
      ];

      const mockCollection = {
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockTags),
        }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      const request = new Request('http://localhost:3000/api/user/tags');
      const response = await GET(request);

      expect(mockDb.collection).toHaveBeenCalledWith('quiztags');
      expect(mockCollection.aggregate).toHaveBeenCalledWith([
        { $match: { userId: 'test@example.com' } },
        { $unwind: '$tags' },
        {
          $group: {
            _id: { value: '$tags.value', type: '$tags.type' },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            value: '$_id.value',
            type: '$_id.type',
            count: 1,
            _id: 0,
          },
        },
      ]);

      expect(response).toEqual([
        { value: 'anatomy', type: 'subject', count: 5 },
        { value: 'physiology', type: 'subject', count: 3 },
      ]);
    });

    it('should filter out invalid tags', async () => {
      const mockTags = [
        { _id: { value: 'valid', type: 'subject' }, count: 5 },
        { _id: { value: null, type: 'subject' }, count: 3 },
        { _id: { value: '', type: 'subject' }, count: 2 },
        { _id: { value: undefined, type: 'subject' }, count: 1 },
      ];

      mockDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockTags),
        }),
      });

      const request = new Request('http://localhost:3000/api/user/tags');
      const response = await GET(request);

      expect(response).toEqual([{ value: 'valid', type: 'subject', count: 5 }]);
    });

    it('should handle database errors', async () => {
      mockDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const request = new Request('http://localhost:3000/api/user/tags');
      const response = await GET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Failed to fetch user tags' },
        { status: 500 },
      );
    });
  });

  describe('POST /api/user/tags', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/user/tags', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    });

    it('should return user tags with counts for POST request', async () => {
      const mockTags = [
        { _id: { value: 'anatomy', type: 'subject' }, count: 5 },
      ];

      mockDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockTags),
        }),
      });

      const request = new Request('http://localhost:3000/api/user/tags', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response).toEqual([
        { value: 'anatomy', type: 'subject', count: 5 },
      ]);
    });
  });
});
