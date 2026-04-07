import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getPdfExtractor } from '../pdf/instance.js';
import { extractMetadataFromText } from '../services/metadata-extract.service.js';
import { BadRequestError, UpstreamError } from '../errors.js';
import { ExtractedMetadataResponseSchema } from '../schemas/item.schema.js';

export async function registerExtractMetadataRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/extract-metadata',
    {
      schema: {
        response: { 200: ExtractedMetadataResponseSchema },
        tags: ['Items'],
        summary: '从PDF提取元数据',
        description: '上传PDF文件，自动提取文献/书籍元数据（标题、作者、摘要等）。',
      },
    },
    async (request) => {
      const data = await request.file();
      if (!data) {
        throw new BadRequestError('No file uploaded');
      }

      if (data.mimetype !== 'application/pdf') {
        throw new BadRequestError('Only PDF files are supported');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      try {
        const pdfExtractor = getPdfExtractor();
        const text = await pdfExtractor.extractText(buffer);
        if (!text.trim()) {
          throw new BadRequestError('Could not extract any text from the PDF');
        }
        return extractMetadataFromText(text);
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        const message = err instanceof Error ? err.message : 'Failed to extract metadata';
        request.log.error(err, 'Metadata extraction failed');
        throw new UpstreamError(message);
      }
    },
  );
}
