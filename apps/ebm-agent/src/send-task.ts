/**
 * 发送任务邮件给 Expert
 *
 * 用法:
 *   pnpm exec tsx src/send-task.ts <expert-email> <subject> <body>
 *   pnpm exec tsx src/send-task.ts pubmed-retrieve@expert "Search papers" "Find articles about AI in healthcare"
 */

import { config } from 'dotenv';
config();

const MAILBOX_URL = process.env.MAILBOX_URL || 'http://localhost:3001';

interface SendMailRequest {
  to: string;
  from: string;
  subject: string;
  body: string;
}

async function sendMail(request: SendMailRequest) {
  const response = await fetch(`${MAILBOX_URL}/api/v1/mail/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const result = await response.json();
  if (!result.success) {
    console.error('Failed to send mail:', result.error);
    process.exit(1);
  }
  console.log(`✓ Mail sent successfully!`);
  console.log(`  Message ID: ${result.messageId}`);
  console.log(`  Sent at: ${result.sentAt}`);
  return result;
}

async function registerAddress(address: string) {
  const response = await fetch(`${MAILBOX_URL}/api/v1/mail/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  const result = await response.json();
  if (!result.success && result.error?.code !== 'ALREADY_EXISTS') {
    console.error('Failed to register address:', result.error);
    process.exit(1);
  }
  console.log(`✓ Address ${address} ready`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(`
发送任务邮件给 Expert

用法:
  pnpm exec tsx src/send-task.ts <expert-email> <subject> <body>

示例:
  pnpm exec tsx src/send-task.ts pubmed-retrieve@expert "Search papers" "Find articles about AI in healthcare"

环境变量:
  MAILBOX_URL - 邮箱服务地址 (默认: http://localhost:3001)
`);
    process.exit(1);
  }

  const [expertEmail, subject, body] = args;
  const fromAddress = process.env.MAIL_FROM || 'test@user';

  // Extract email local part for sender
  const fromLocal = fromAddress.split('@')[0];

  console.log(`Sending task to: ${expertEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}\n`);

  // Register recipient address if needed
  await registerAddress(expertEmail);

  // Send the mail
  await sendMail({
    to: expertEmail,
    from: fromAddress,
    subject,
    body,
  });
}

main().catch(console.error);
