# Simplified Chat System

This document describes the new simplified chat system that separates frontend and backend concerns, making it easier to develop backend-initiated multi-round conversations.

## Overview

The new system replaces the complex `useChatRuntime` hook and related infrastructure with a clean, event-driven architecture:

- **Frontend**: Simple React hook (`useSimpleChat`) with minimal state management
- **Backend**: RESTful API endpoints for streaming and message pushing
- **Communication**: Server-Sent Events (SSE) for real-time updates

## Architecture

### 1. Frontend Components

#### `useSimpleChat` Hook

- **Purpose**: Simplified chat interface for React components
- **Features**:
  - Automatic session management
  - Real-time message streaming
  - Minimal state management
  - Easy integration

```typescript
const {
  messages, // Array of chat messages
  isConnected, // Connection status
  isLoading, // Loading state
  sessionId, // Current session ID
  sendMessage, // Send user message
  clearChat, // Clear conversation
  connect, // Connect to new/existing session
  disconnect, // Disconnect from session
} = useSimpleChat();
```

#### `SimpleChat` Component

- **Purpose**: Ready-to-use chat UI component
- **Features**:
  - Clean, responsive design
  - Real-time message display
  - Connection status indicator
  - Loading states

### 2. Backend API Endpoints

#### POST `/api/chat/stream`

- **Purpose**: Start a new conversation or send user message
- **Body**: `{ sessionId: string, message: string }`
- **Response**: SSE stream with real-time updates

#### PUT `/api/chat/stream`

- **Purpose**: Push messages from backend to frontend
- **Body**: `{ sessionId: string, type: string, content: string, data?: any }`
- **Response**: `{ success: true }`

#### GET `/api/chat/stream?sessionId={id}`

- **Purpose**: Get conversation history
- **Response**: `{ messages: ChatMessage[] }`

#### DELETE `/api/chat/stream?sessionId={id}`

- **Purpose**: Clear session and history
- **Response**: `{ success: true }`

### 3. Backend Service

#### `ChatBackendService`

- **Purpose**: Backend-to-frontend communication service
- **Features**:
  - Session management
  - Multi-round conversation support
  - AI agent integration
  - Message queuing

```typescript
// Start a conversation from backend
await chatBackendService.startConversation(sessionId, "Hello from backend!");

// Continue conversation
await chatBackendService.continueConversation(sessionId, "Next message...");

// Complete conversation
await chatBackendService.completeConversation(sessionId, "Goodbye!");

// Use AI agent
await chatBackendService.processWithAgent(sessionId, userQuery, agentConfig);
```

## Usage Examples

### Basic Frontend Usage

```typescript
import { SimpleChat } from '@/components/SimpleChat';

function MyApp() {
  return (
    <div>
      <h1>Chat with AI</h1>
      <SimpleChat />
    </div>
  );
}
```

### Advanced Frontend Usage

```typescript
import { useSimpleChat } from '@/hooks/useSimpleChat';

function CustomChat() {
  const { messages, sendMessage, sessionId } = useSimpleChat();

  useEffect(() => {
    // Connect to specific session
    connect('my-session-123');
  }, []);

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello')}>
        Send Message
      </button>
    </div>
  );
}
```

### Backend Usage

```typescript
import { chatBackendService } from "@/lib/services/ChatBackendService";

// Create new session
const sessionId = chatBackendService.createSession();

// Start multi-round conversation
await chatBackendService.startConversation(
  sessionId,
  "Welcome! I'll guide you through a medical consultation.",
);

// Continue with follow-up questions
setTimeout(async () => {
  await chatBackendService.continueConversation(
    sessionId,
    "Based on your symptoms, I recommend...",
  );
}, 3000);

// Use AI agent for complex processing
await chatBackendService.processWithAgent(
  sessionId,
  "What are the symptoms of hypertension?",
  { rag_config: { useHyDE: true } },
);
```

## Migration Guide

### From Old System to New System

1. **Replace `useChatRuntime`**:

   ```typescript
   // Old
   const { messages, sendMessage, loading } = useChatRuntime();

   // New
   const { messages, sendMessage, isLoading } = useSimpleChat();
   ```

2. **Update API calls**:

   ```typescript
   // Old
   fetch("/api/chatbot", { method: "POST", body: JSON.stringify(chatReq) });

   // New
   fetch("/api/chat/stream", {
     method: "POST",
     body: JSON.stringify({ sessionId, message }),
   });
   ```

3. **Backend message pushing**:
   ```typescript
   // Old: Complex state management in frontend
   // New: Simple backend push
   await chatBackendService.pushMessage(sessionId, {
     type: "ai",
     content: "Message from backend",
   });
   ```

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Agent Configuration

The new system supports the same agent configuration as before:

```typescript
const agentConfig = {
  rag_config: {
    useHyDE: true,
    useHybrid: false,
    topK: 10,
    language: "zh",
  },
};
```

## Benefits

1. **Simplified Frontend**: No complex state management
2. **Backend Control**: Full control over conversation flow
3. **Real-time Updates**: Instant message delivery
4. **Session Management**: Automatic cleanup and persistence
5. **Scalable**: Easy to extend with new features
6. **Clean Architecture**: Clear separation of concerns

## Testing

Visit `/chat-demo` to see a live demonstration of the new system with:

- Frontend chat interface
- Backend message controls
- Multi-round conversation examples
- Real-time updates

## Future Enhancements

- WebSocket support for bidirectional communication
- Message persistence to database
- Typing indicators
- File upload support
- Voice message support
- Multi-user chat rooms
