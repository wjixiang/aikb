import { b } from '@/baml_client';
import { NextRequest, NextResponse } from 'next/server';
import type { TranslationCorrection } from '@/types/baml';

export async function POST(req: NextRequest) {
  try {
    const { original, translation, fullText } = await req.json();

    const bamlStream = b.stream.CorrectTranslation(
      original,
      translation,
      fullText,
    );
    let preChunk: TranslationCorrection = {
      correction: '',
      fullTrans: '',
      grammar_teach: '',
      score: 0,
      suggestions: '',
    };
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of bamlStream) {
          // Deduplicate string fields where possible
          const dedupedChunk = {
            correction:
              chunk.correction &&
              preChunk.correction &&
              typeof chunk.correction === 'string' &&
              typeof preChunk.correction === 'string' &&
              chunk.correction.startsWith(preChunk.correction)
                ? chunk.correction.substring(preChunk.correction.length)
                : chunk.correction,
            fullTrans:
              chunk.fullTrans &&
              preChunk.fullTrans &&
              typeof chunk.fullTrans === 'string' &&
              typeof preChunk.fullTrans === 'string' &&
              chunk.fullTrans.startsWith(preChunk.fullTrans)
                ? chunk.fullTrans.substring(preChunk.fullTrans.length)
                : chunk.fullTrans,
            grammar_teach:
              chunk.grammar_teach &&
              preChunk.grammar_teach &&
              typeof chunk.grammar_teach === 'string' &&
              typeof preChunk.grammar_teach === 'string' &&
              chunk.grammar_teach.startsWith(preChunk.grammar_teach)
                ? chunk.grammar_teach.substring(preChunk.grammar_teach.length)
                : chunk.grammar_teach,
            score: chunk.score, // Skip deduplication for non-string fields
            suggestions:
              chunk.suggestions &&
              preChunk.suggestions &&
              typeof chunk.suggestions === 'string' &&
              typeof preChunk.suggestions === 'string' &&
              chunk.suggestions.startsWith(preChunk.suggestions)
                ? chunk.suggestions.substring(preChunk.suggestions.length)
                : chunk.suggestions,
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(dedupedChunk)}\n\n`),
          );
          preChunk = chunk as TranslationCorrection;
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Translation correction error:', error);
    return NextResponse.json(
      { error: 'Failed to process translation correction' },
      { status: 500 },
    );
  }
}
