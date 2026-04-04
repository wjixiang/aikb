import { z } from 'zod';
import { ApiClientFactory } from 'llm-api-client';
import type { ProviderSettings } from 'llm-api-client';
import { config } from '../config.js';

// ============ Schema ============

export const ExtractedMetadataSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  year: z.number().int().min(1000).max(9999).optional(),
  source: z.string().optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  pmid: z.string().optional(),
  type: z.enum(['article', 'book']).optional(),
});

export type ExtractedMetadata = z.infer<typeof ExtractedMetadataSchema>;

// ============ Prompt ============

const SYSTEM_PROMPT = `You are a metadata extraction assistant for academic papers and books. Given the text content from a PDF document, extract structured bibliographic metadata.

Rules:
- Return ONLY a valid JSON object, no markdown, no explanation, no code fences.
- If a field cannot be determined from the text, omit it entirely.
- "authors" should be an array of full names (e.g., ["John Smith", "Jane Doe"]).
- "source" is the journal name for articles, or the publisher for books.
- "type" should be "article" for papers/journal articles, "book" for books/book chapters.
- "year" should be a 4-digit number.

JSON schema:
{
  "title": "string (required)",
  "authors": ["string"],
  "abstract": "string",
  "year": 2024,
  "source": "string",
  "doi": "string",
  "isbn": "string",
  "pmid": "string",
  "type": "article" | "book"
}`;

// ============ Service ============

function createClient() {
  const { provider, apiKey, modelId } = config.llm;

  if (!apiKey) {
    throw new Error('LLM_API_KEY environment variable is not set');
  }

  const settings: ProviderSettings = {
    apiProvider: provider as ProviderSettings['apiProvider'],
    apiKey,
    apiModelId: modelId,
    modelMaxTokens: 4096,
    modelTemperature: 0.1,
  };

  return ApiClientFactory.create(settings);
}

export async function extractMetadataFromText(pdfText: string): Promise<ExtractedMetadata> {
  const client = createClient();

  // Truncate if too long (rough estimate: ~4 chars per token, keep under 12k tokens)
  const maxTextLength = 48000;
  const truncatedText = pdfText.length > maxTextLength
    ? pdfText.slice(0, maxTextLength) + '\n\n[...truncated...]'
    : pdfText;

  const response = await client.makeRequest(
    SYSTEM_PROMPT,
    truncatedText,
    [],
    { timeout: 60000 },
  );

  const rawText = response.textResponse.trim();

  // Strip markdown code fences if present
  let jsonStr = rawText;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonStr);
  return ExtractedMetadataSchema.parse(parsed);
}
