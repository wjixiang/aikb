/**
 * API endpoint for rebuilding the entire link index
 */

import { NextResponse } from 'next/server';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';
import { LinkSchemaManager } from '@/kgrag/database/linkSchema';

const linkService = new LinkIndexingService();

export async function POST(request: Request) {
  try {
    const { force = false } = await request.json();

    if (!force) {
      return NextResponse.json(
        { error: 'Use force: true to confirm reindexing' },
        { status: 400 },
      );
    }

    // Initialize schema if needed
    await LinkSchemaManager.initializeCollection();

    // Rebuild index
    const processedCount = await linkService.rebuildIndex();

    return NextResponse.json({
      success: true,
      processedCount,
      message: 'Link index rebuilt successfully',
    });
  } catch (error) {
    console.error('Error rebuilding link index:', error);
    return NextResponse.json(
      { error: 'Failed to rebuild link index' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Initialize schema
    await LinkSchemaManager.initializeCollection();

    return NextResponse.json({
      ready: true,
      message: 'Link indexing system is ready',
    });
  } catch (error) {
    console.error('Error initializing link system:', error);
    return NextResponse.json(
      { error: 'Failed to initialize link system' },
      { status: 500 },
    );
  }
}
