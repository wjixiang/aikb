import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { b } from '../../../baml_client';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  createdAt?: Date;
  experimental_attachments?: any[];
  toolInvocations?: any[];
  parts?: any[];
}

export interface StreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
}

@Injectable()
export class ChatService {
  async generateResponse(messages: Message[]): Promise<{ content: string }> {
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage && lastMessage.role === 'user') {
      try {
        // Use BAML to generate a response
        const response = await b.stream.ChatResponse(lastMessage.content);
        return {
          content: response.toString()
        };
      } catch (error) {
        console.error('Error generating BAML response:', error);
        // Fallback to simple response
        return {
          content: `I received your message: "${lastMessage.content}". I'm having trouble generating a response right now.`
        };
      }
    }
    
    return {
      content: 'Hello! How can I help you today?'
    };
  }

  generateStreamResponse(messages: Message[]): Observable<StreamChunk> {
    return new Observable<StreamChunk>((subscriber) => {
      const lastMessage = messages[messages.length - 1];
      
      if (!lastMessage || lastMessage.role !== 'user') {
        subscriber.next({ content: String('Hello! How can I help you today?') });
        subscriber.next({ done: true });
        subscriber.complete();
        return;
      }

      const processStream = async () => {
        try {
          // Use BAML non-streaming API for now to get a proper response
          const response = await b.ChatResponse(lastMessage.content);
          
          
          // Handle the response properly
          let responseText: string;
          if (typeof response === 'string') {
            responseText = response;
          } else if (response && typeof response === 'object') {
            // If it's an object, try to extract string content
            const responseObj = response as any;
            if (responseObj.content && typeof responseObj.content === 'string') {
              responseText = responseObj.content;
            } else if (responseObj.text && typeof responseObj.text === 'string') {
              responseText = responseObj.text;
            } else if (responseObj.message && typeof responseObj.message === 'string') {
              responseText = responseObj.message;
            } else {
              // Fallback to JSON string representation
              responseText = JSON.stringify(response);
            }
          } else {
            responseText = String(response);
          }
          
          
          // Simulate streaming by sending chunks of the response
          // Use smaller chunk size and better UTF-8 handling
          const chunkSize = 5; // characters per chunk
          for (let i = 0; i < responseText.length; i += chunkSize) {
            const chunk = responseText.slice(i, i + chunkSize);
            subscriber.next({ content: chunk });
            
            // Add a small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          
          subscriber.next({ done: true });
          subscriber.complete();
        } catch (error) {
          console.error('Error generating BAML response:', error);
          subscriber.next({
            error: String(`I received your message: "${lastMessage.content}". I'm having trouble generating a response right now.`)
          });
          subscriber.next({ done: true });
          subscriber.complete();
        }
      };

      processStream();
    });
  }
}