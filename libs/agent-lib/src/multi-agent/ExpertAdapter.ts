/**
 * ExpertAdapter - Bridge between MessageBus (Email-style) and Expert System
 *
 * Responsibilities:
 * - Subscribe to Expert's inbox (mail address)
 * - Handle new mail events and process tasks
 * - Send results back to sender via MessageBus
 */

import { injectable, inject } from 'inversify';
import type {
  IMessageBus,
  MailMessage,
  OutgoingMail,
  IMailListener,
  SubscriptionId,
  MailAddress,
} from './types.js';
import type { ExpertTask, ExpertResult, IExpertExecutor } from '../core/expert/types.js';
import { TYPES } from '../core/di/types.js';

/**
 * ExpertAdapter Configuration
 */
export interface ExpertAdapterConfig {
  /** Expert ID */
  expertId: string;
  /** Message processing timeout (ms) */
  messageTimeout?: number;
}

/**
 * ExpertAdapter Implementation
 */
@injectable()
export class ExpertAdapter {
  private subscriptionId: SubscriptionId | undefined;
  private running: boolean = false;

  constructor(
    @inject(TYPES.IMessageBus) private messageBus: IMessageBus,
    @inject(TYPES.IExpertExecutor) private expertExecutor: IExpertExecutor,
    private config: ExpertAdapterConfig
  ) {}

  /**
   * Get expert ID
   */
  getExpertId(): string {
    return this.config.expertId;
  }

  /**
   * Get expert mail address
   */
  getAddress(): MailAddress {
    return `${this.config.expertId}@expert`;
  }

  /**
   * Start - Subscribe to expert's inbox
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn(`[ExpertAdapter:${this.config.expertId}] Already running`);
      return;
    }

    // Ensure message bus is initialized
    if (!this.messageBus.isReady()) {
      await this.messageBus.initialize();
    }

    // Subscribe to expert's inbox
    this.subscriptionId = this.messageBus.subscribe(
      this.getAddress(),
      {
        onNewMail: async (mail: MailMessage) => {
          await this.handleNewMail(mail);
        },
        onError: (error: Error) => {
          console.error(`[ExpertAdapter:${this.config.expertId}] Error:`, error);
        },
      }
    );

    this.running = true;
    console.log(`[ExpertAdapter:${this.config.expertId}] Started, subscribed to inbox`);
  }

  /**
   * Stop - Unsubscribe from inbox
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.subscriptionId) {
      this.messageBus.unsubscribe(this.subscriptionId);
      this.subscriptionId = undefined;
    }

    this.running = false;
    console.log(`[ExpertAdapter:${this.config.expertId}] Stopped`);
  }

  /**
   * Check if adapter is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle new mail - Process task
   */
  private async handleNewMail(mail: MailMessage): Promise<void> {
    console.log(`[ExpertAdapter:${this.config.expertId}] Received mail: ${mail.messageId}`);

    try {
      // 构建 ExpertTask
      const expertTask: ExpertTask = {
        taskId: mail.taskId || mail.messageId,
        description: mail.subject,
        input: {
          originalMail: {
            messageId: mail.messageId,
            subject: mail.subject,
            body: mail.body,
            attachments: mail.attachments,
            payload: mail.payload,
          },
          ...(mail.payload || {}),
        },
      };

      // Get or create expert instance
      let expert = this.expertExecutor.getExpert(this.config.expertId);
      if (!expert) {
        expert = await this.expertExecutor.createExpert(this.config.expertId);
        // Start in message-driven mode
        expert.start();
      }

      // Note: In the new architecture, Expert itself polls inbox for tasks.
      // This adapter is kept for backward compatibility but the actual task
      // execution is now handled by Expert.run() internally.
      // For now, we just mark the mail as read since Expert will process it.
      await this.messageBus.markAsRead(mail.messageId);

      console.log(`[ExpertAdapter:${this.config.expertId}] Mail forwarded to Expert (will be processed in message-driven mode)`);
    } catch (error) {
      console.error(`[ExpertAdapter:${this.config.expertId}] Error processing mail:`, error);

      // 发送错误结果
      await this.sendErrorResult(mail, error);
    }
  }

  /**
   * Send result mail back to sender
   */
  private async sendResult(
    originalMail: MailMessage,
    expertResult: ExpertResult,
    duration: number
  ): Promise<void> {
    // 确定收件人（回发给 MC 或其他 Expert）
    const receiver = originalMail.from;

    // 从 artifacts 提取附件
    const attachments: string[] = [];
    if (expertResult.artifacts) {
      for (const artifact of expertResult.artifacts) {
        if (artifact.metadata?.['s3Key']) {
          attachments.push(artifact.metadata['s3Key'] as string);
        }
      }
    }

    const resultMail: OutgoingMail = {
      from: this.getAddress(),
      to: receiver,
      subject: `Re: ${originalMail.subject}`,
      body: expertResult.summary,
      attachments: attachments.length > 0 ? attachments : undefined,
      payload: {
        output: expertResult.output,
        artifacts: expertResult.artifacts,
        errors: expertResult.errors,
        success: expertResult.success,
        duration,
      },
      priority: 'normal',
      inReplyTo: originalMail.messageId,
      taskId: originalMail.taskId,
    };

    await this.messageBus.send(resultMail);
  }

  /**
   * Send error result back to sender
   */
  private async sendErrorResult(
    originalMail: MailMessage,
    error: unknown
  ): Promise<void> {
    const receiver = originalMail.from;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorMail: OutgoingMail = {
      from: this.getAddress(),
      to: receiver,
      subject: `Error: ${originalMail.subject}`,
      body: `处理失败: ${errorMessage}`,
      payload: {
        error: errorMessage,
        success: false,
      },
      priority: 'high',
      inReplyTo: originalMail.messageId,
      taskId: originalMail.taskId,
    };

    await this.messageBus.send(errorMail);
  }
}

/**
 * Create ExpertAdapter factory function
 */
export function createExpertAdapter(
  messageBus: IMessageBus,
  expertExecutor: IExpertExecutor,
  expertId: string
): ExpertAdapter {
  return new ExpertAdapter(messageBus, expertExecutor, {
    expertId,
    messageTimeout: 300000,
  });
}
