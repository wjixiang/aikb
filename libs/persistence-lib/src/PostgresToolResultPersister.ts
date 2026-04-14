import { injectable } from 'inversify';
import type { PrismaClient } from './generated/prisma/client.js';
import { getLogger } from '@shared/logger';
import type {
  IToolResultPersister,
  PersistedToolResult,
  PersistResult,
} from './types.js';
import {
  DEFAULT_MAX_RESULT_SIZE_CHARS,
  PREVIEW_SIZE_BYTES,
} from './types.js';

const PERSISTED_OUTPUT_TAG = '<persisted-output>';
const PERSISTED_OUTPUT_CLOSING_TAG = '</persisted-output>';
const TOOL_RESULT_CLEARED_MESSAGE = '[Old tool result content cleared]';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function generatePreview(
  content: string,
  maxBytes: number,
): { preview: string; hasMore: boolean } {
  if (content.length <= maxBytes) {
    return { preview: content, hasMore: false };
  }
  const truncated = content.slice(0, maxBytes);
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint =
    lastNewline > maxBytes * 0.5 ? lastNewline : maxBytes;
  return { preview: content.slice(0, cutPoint), hasMore: true };
}

function buildLargeToolResultMessage(
  toolName: string,
  filepath: string,
  originalSize: number,
  preview: string,
  hasMore: boolean,
): string {
  let message = `${PERSISTED_OUTPUT_TAG}\n`;
  message += `${toolName} output too large (${formatFileSize(originalSize)}). Full output saved to: ${filepath}\n\n`;
  message += `Preview (first ${formatFileSize(PREVIEW_SIZE_BYTES)}):\n`;
  message += preview;
  message += hasMore ? '\n...\n' : '\n';
  message += PERSISTED_OUTPUT_CLOSING_TAG;
  return message;
}

@injectable()
export class PostgresToolResultPersister implements IToolResultPersister {
  private logger = getLogger('PostgresToolResultPersister');

  constructor(private prisma: PrismaClient) {}

  async persist(
    instanceId: string,
    toolUseId: string,
    toolName: string,
    content: string,
  ): Promise<PersistResult> {
    const size = content.length;

    if (size <= DEFAULT_MAX_RESULT_SIZE_CHARS) {
      return {
        persistedId: content,
        preview: content,
        originalSize: size,
        hasMore: false,
      };
    }

    const persisted = await this.prisma.persistedToolResult.upsert({
      where: { toolUseId },
      create: {
        instanceId,
        toolUseId,
        toolName,
        content,
        size,
      },
      update: {
        content,
        size,
      },
    });

    const { preview, hasMore } = generatePreview(content, PREVIEW_SIZE_BYTES);
    const previewMessage = buildLargeToolResultMessage(
      toolName,
      persisted.id,
      size,
      preview,
      hasMore,
    );

    this.logger.debug(
      { toolUseId, toolName, size, previewSize: previewMessage.length },
      '[PostgresToolResultPersister] Persisted tool result',
    );

    return {
      persistedId: persisted.id,
      preview: previewMessage,
      originalSize: size,
      hasMore,
    };
  }

  async retrieve(id: string): Promise<string | null> {
    const result = await this.prisma.persistedToolResult.findUnique({
      where: { id },
    });
    return result?.content ?? null;
  }

  async retrieveByToolUseId(
    toolUseId: string,
  ): Promise<PersistedToolResult | null> {
    const result = await this.prisma.persistedToolResult.findUnique({
      where: { toolUseId },
    });
    if (!result) return null;
    return {
      id: result.id,
      instanceId: result.instanceId,
      toolUseId: result.toolUseId,
      toolName: result.toolName,
      content: result.content,
      size: result.size,
      createdAt: result.createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.persistedToolResult.delete({ where: { id } });
    this.logger.debug({ id }, '[PostgresToolResultPersister] Deleted tool result');
  }

  async deleteByInstanceId(instanceId: string): Promise<void> {
    await this.prisma.persistedToolResult.deleteMany({
      where: { instanceId },
    });
    this.logger.debug(
      { instanceId },
      '[PostgresToolResultPersister] Deleted all tool results for instance',
    );
  }

  async deleteByToolUseId(toolUseId: string): Promise<void> {
    await this.prisma.persistedToolResult.deleteMany({
      where: { toolUseId },
    });
    this.logger.debug(
      { toolUseId },
      '[PostgresToolResultPersister] Deleted tool result by toolUseId',
    );
  }
}
