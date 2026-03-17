import { WebSocket } from 'ws';
import { MailAddress, MailMessage } from '../storage/type.js';

/**
 * Subscription information
 */
interface Subscription {
  address: MailAddress;
  socket: WebSocket;
  connectedAt: Date;
}

/**
 * WebSocket Subscription Manager
 * Manages WebSocket connections and broadcasts new mail notifications
 */
export class SubscriptionManager {
  private subscriptions = new Map<WebSocket, Subscription>();
  private addressIndex = new Map<MailAddress, Set<WebSocket>>();

  /**
   * Subscribe a WebSocket to an address
   */
  subscribe(socket: WebSocket, address: MailAddress): void {
    // Store subscription
    const subscription: Subscription = {
      address,
      socket,
      connectedAt: new Date(),
    };
    this.subscriptions.set(socket, subscription);

    // Add to address index
    let sockets = this.addressIndex.get(address);
    if (!sockets) {
      sockets = new Set();
      this.addressIndex.set(address, sockets);
    }
    sockets.add(socket);

    // Send confirmation
    this.sendMessage(socket, {
      type: 'subscribed',
      address,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe a WebSocket
   */
  unsubscribe(socket: WebSocket): void {
    const subscription = this.subscriptions.get(socket);
    if (subscription) {
      // Remove from address index
      const sockets = this.addressIndex.get(subscription.address);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          this.addressIndex.delete(subscription.address);
        }
      }

      // Remove subscription
      this.subscriptions.delete(socket);
    }
  }

  /**
   * Notify subscribers of a new mail message
   */
  notifyNewMail(toAddress: MailAddress, message: MailMessage): void {
    const sockets = this.addressIndex.get(toAddress);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const notification = {
      type: 'new_mail',
      mail: {
        messageId: message.messageId,
        subject: message.subject,
        from: message.from,
        to: message.to,
        sentAt: message.sentAt,
        priority: message.priority,
      },
      timestamp: new Date().toISOString(),
    };

    for (const socket of sockets) {
      this.sendMessage(socket, notification);
    }
  }

  /**
   * Notify multiple recipients of new mail
   */
  notifyNewMailMulti(recipients: MailAddress[], message: MailMessage): void {
    for (const recipient of recipients) {
      this.notifyNewMail(recipient, message);
    }
  }

  /**
   * Get active subscription count for an address
   */
  getSubscriberCount(address: MailAddress): number {
    return this.addressIndex.get(address)?.size ?? 0;
  }

  /**
   * Get total active subscriptions
   */
  getTotalSubscriptions(): number {
    return this.subscriptions.size;
  }

  /**
   * Get all subscribed addresses
   */
  getSubscribedAddresses(): MailAddress[] {
    return Array.from(this.addressIndex.keys());
  }

  /**
   * Send a message to a specific socket
   */
  private sendMessage(socket: WebSocket, message: unknown): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

// Singleton instance
export const subscriptionManager = new SubscriptionManager();
