import { Controller, Post, Body, Res, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService, Message, StreamChunk } from './chat.service';
import { Observable } from 'rxjs';

export interface ChatRequest {
  messages: Message[];
  attachments?: any[];
}

export interface ChatResponse {
  content: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    return this.chatService.generateResponse(request.messages);
  }

  @Post('stream')
  async chatStream(
    @Body() request: ChatRequest,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ): Promise<void> {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    try {
      const stream$ = this.chatService.generateStreamResponse(request.messages);

      stream$.subscribe({
        next: (chunk: StreamChunk) => {
          if (chunk.error) {
            const errorData = JSON.stringify({ error: chunk.error });
            res.write(`data: ${errorData}\n\n`);
          } else if (chunk.content) {
            const contentData = JSON.stringify({ content: chunk.content });
            res.write(`data: ${contentData}\n\n`);
          }

          if (chunk.done) {
            const doneData = JSON.stringify({ done: true });
            res.write(`data: ${doneData}\n\n`);
            res.end();
          }
        },
        error: (error) => {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ error: 'Stream error occurred' });
          res.write(`data: ${errorData}\n\n`);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.write(
        `data: ${JSON.stringify({ error: 'Failed to start stream' })}\n\n`,
      );
      res.end();
    }
  }
}
