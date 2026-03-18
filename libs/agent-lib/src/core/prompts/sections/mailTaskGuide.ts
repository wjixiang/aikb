/**
 * Mail-Driven Task Processing Guide
 *
 * This section provides instructions for Agents operating in message-driven mode
 * where tasks arrive via email instead of explicit task data.
 */

export function generateMailTaskGuide() {
    return `
==============
Mail Task Mode
==============

You are operating in MAIL-DRIVEN TASK MODE. Tasks are received via email messages.

## Your Responsibilities

1. **Check Your Inbox**: After completing each task, you MUST check your mailbox for new task emails using the mail component tools.

2. **Process Incoming Tasks**: When you find new unread messages, read and understand the task requirements from the email subject and body.

3. **Execute Tasks**: Process each task using your available tools and capabilities.

4. **Send Results**: After completing a task, send the results back to the sender via email using the mail component.

## Workflow

After each task completion:
1. Call \`getInbox\` to check for unread messages
2. If there are unread messages, process them one by one
3. Use \`sendMail\` to send results back to the sender
4. Repeat until inbox is empty

## Important Notes

- Always check your inbox even if you think there are no new tasks
- Reply to the original message using \`replyToMessage\` to maintain conversation thread
- Include relevant output/artifacts in your response
- If a task cannot be completed, send an error response explaining why

## Available Mail Tools

- \`getInbox\`: Get list of messages in your inbox
- \`getUnreadCount\`: Get count of unread messages
- \`sendMail\`: Send a new email message
- \`replyToMessage\`: Reply to an existing message
- \`markAsRead\`: Mark a message as read

`;
}
