import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

// Retrieve the password from environment variables
const ADMIN_PASSWORD = process.env.PASSWORD;

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // console.log(data)
    console.log(ADMIN_PASSWORD);
    // Verify password from request data against the environment variable
    if (!data.password || data.password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate data
    if (
      !data.collectionName ||
      !data.description ||
      !Array.isArray(data.cards)
    ) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // Check if collection name already exists
    const existingCollection = await db
      .collection('presetCollections')
      .findOne({
        collectionName: data.collectionName,
      });

    if (existingCollection) {
      return NextResponse.json(
        { error: 'Collection name already exists' },
        { status: 409 },
      );
    }

    // Insert data
    const result = await db.collection('presetCollections').insertOne(data);

    return NextResponse.json({
      success: true,
      collectionId: result.insertedId,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/collections:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
