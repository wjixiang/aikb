/**
 * API endpoint for retrieving forward links
 */

import { NextResponse } from 'next/server';
import knowledgeBase from '@/kgrag/knowledgeBase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('searchParams', searchParams);
    const documentId =
      searchParams.get('documentId') || searchParams.get('path');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId or path parameter is required' },
        { status: 400 },
      );
    }
    const kdb = new knowledgeBase();

    // 查询 forward links
    // The documentId here is actually s3_key. need to be corrected in future.
    const forwardLinks = await kdb.getForwardLinks(documentId);

    // 格式化返回数据
    const formattedLinks = forwardLinks.map((link) => ({
      sourceId: link.sourceId,
      targetId: link.targetId,
      targetTitle:
        link.targetTitle || link.targetId.split('/').pop() || 'Untitled',
      linkType: link.linkType,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));

    console.log('forward:', formattedLinks);

    return NextResponse.json({
      documentId,
      links: formattedLinks,
      count: formattedLinks.length,
    });
  } catch (error) {
    console.error('Error retrieving forward links:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve forward links',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
