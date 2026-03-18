# Mail Component

Email-style messaging component for agent-to-agent communication via the agent-mailbox service.

## Features

- **Send/Receive Messages**: Agents can send emails to each other using addresses like `expertId@expert`
- **Inbox Management**: View inbox with filtering (unread, starred) and pagination
- **Message Status**: Mark messages as read/unread, star/unstar, delete
- **Search**: Search messages by subject, body, sender, or recipient
- **Reply**: Reply to existing messages with thread tracking
- **Address Registration**: Register new mailbox addresses

## Installation

The MailComponent is part of agent-lib:

```typescript
import { MailComponent, createMailComponent } from 'agent-lib';
```

## Quick Start

```typescript
import { createMailComponent } from 'agent-lib';

// Create component
const mail = createMailComponent({
  baseUrl: 'http://localhost:3000',  // agent-mailbox service URL
  defaultAddress: 'myagent@expert',   // This agent's email address
});

// Register address (first time)
await mail.handleToolCall('registerAddress', {
  address: 'myagent@expert'
});

// Send a message
await mail.handleToolCall('sendMail', {
  to: 'pubmed@expert',
  subject: 'Search for diabetes treatment papers',
  body: 'Please search for recent papers about diabetes treatment...',
  priority: 'normal'
});

// Check inbox
const result = await mail.handleToolCall('getInbox', {});
console.log(result.data.messages);

// Check unread count
const unread = await mail.handleToolCall('getUnreadCount', {});
console.log(`Unread: ${unread.data.count}`);
```

## Available Tools

### sendMail
Send an email to another agent.

```typescript
{
  to: string;           // Recipient address (e.g., "pubmed@expert")
  subject: string;      // Email subject
  body: string;         // Email body
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  taskId?: string;      // Associated task ID
  attachments?: string[]; // S3 keys of attachments
  payload?: object;     // Additional JSON data
}
```

### getInbox
Get inbox messages with optional filtering.

```typescript
{
  address?: string;     // Mailbox address (defaults to component defaultAddress)
  limit?: number;       // Max messages (default: 20)
  offset?: number;      // Skip N messages (default: 0)
  unreadOnly?: boolean; // Filter unread only
  starredOnly?: boolean;// Filter starred only
}
```

### getUnreadCount
Get the count of unread messages.

```typescript
{
  address?: string;     // Mailbox address
}
```

### markAsRead / markAsUnread
Mark a message as read or unread.

```typescript
{
  messageId: string;    // Message ID
}
```

### starMessage / unstarMessage
Star or unstar a message.

```typescript
{
  messageId: string;    // Message ID
}
```

### deleteMessage
Soft delete a message.

```typescript
{
  messageId: string;    // Message ID
}
```

### searchMessages
Search messages across mailboxes.

```typescript
{
  query?: string;       // Search text
  from?: string;        // Filter by sender
  to?: string;          // Filter by recipient
  unread?: boolean;     // Filter by unread
  starred?: boolean;    // Filter by starred
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
```

### replyToMessage
Reply to an existing message.

```typescript
{
  messageId: string;    // Original message ID
  body: string;         // Reply body
  attachments?: string[];
  payload?: object;
}
```

### registerAddress
Register a new mailbox address.

```typescript
{
  address: string;      // Address to register (e.g., "myagent@expert")
}
```

## Direct API Usage

Instead of using tool calls, you can also call methods directly:

```typescript
// Send mail directly
const result = await mail.sendMail({
  from: 'myagent@expert',
  to: 'other@expert',
  subject: 'Hello',
  body: 'World',
});

// Get inbox
const inbox = await mail.getInbox('myagent@expert', {
  pagination: { limit: 10, offset: 0 },
  unreadOnly: true,
});

// Mark as read
await mail.markAsRead('mail_1234567890_abc');
```

## Configuration

```typescript
interface MailComponentConfig {
  baseUrl: string;           // Mailbox service base URL (required)
  defaultAddress?: string;   // Default sender address
  apiKey?: string;          // API key for authentication
  timeout?: number;         // Request timeout in ms (default: 30000)
}
```

## Integration with Expert System

The MailComponent can be used within an Expert to enable email-based communication:

```typescript
import { Expert, MailComponent } from 'agent-lib';

class CommunicationExpert extends Expert {
  private mailComponent: MailComponent;

  constructor() {
    super();
    this.mailComponent = new MailComponent({
      baseUrl: 'http://localhost:3000',
      defaultAddress: 'communication@expert',
    });
  }

  async initialize() {
    // Register mail tools with this expert
    this.toolSet = this.mailComponent.toolSet;
  }

  async execute(task: ExpertTask): Promise<ExpertResult> {
    // Handle tool calls via mail component
    const result = await this.mailComponent.handleToolCall(
      task.toolName,
      task.params
    );
    return {
      success: result.success,
      output: result.data,
      summary: result.summary,
    };
  }
}
```

## Architecture

```
┌─────────────────┐     REST API      ┌──────────────────┐
│  MailComponent  │ ◄────────────────►│  agent-mailbox   │
│   (Agent side)  │                   │   (Server side)  │
└─────────────────┘                   └──────────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  PostgreSQL  │
                                        │   Storage    │
                                        └──────────────┘
```

The MailComponent acts as a client to the agent-mailbox service, which provides:
- RESTful API for mail operations
- Persistent storage via PostgreSQL
- WebSocket support for real-time notifications

## See Also

- [agent-mailbox Design](/apps/agent-mailbox/DESIGN.md)
- [MessageBus Documentation](/libs/agent-lib/src/multi-agent/MAIL_DESIGN.md)
