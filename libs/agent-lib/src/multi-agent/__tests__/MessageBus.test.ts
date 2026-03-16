import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBus } from '../MessageBus';
import type { MailAddress, IMailListener, MailMessage } from '../types';

describe('MessageBus', () => {
    let messageBus: MessageBus;

    beforeEach(async () => {
        messageBus = new MessageBus();
        await messageBus.initialize();
    });

    describe('send and receive', () => {
        it('should send mail to recipient inbox', async () => {
            const from: MailAddress = { type: 'mc', mcId: 'main' };
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            const mail = await messageBus.send({
                from,
                to,
                subject: 'Search for cancer',
                body: 'Find papers about cancer treatment',
            });

            expect(mail.subject).toBe('Search for cancer');
            expect(mail.from).toEqual(from);
            expect(mail.to).toEqual(to);

            // Check recipient inbox
            const inbox = messageBus.getInbox(to);
            expect(inbox).toHaveLength(1);
            expect(inbox[0].subject).toBe('Search for cancer');
        });

        it('should send to multiple recipients', async () => {
            const from: MailAddress = { type: 'mc', mcId: 'main' };
            const to: MailAddress[] = [
                { type: 'expert', expertId: 'pubmed' },
                { type: 'expert', expertId: 'analysis' },
            ];

            await messageBus.send({
                from,
                to,
                subject: 'Process this',
            });

            expect(messageBus.getInbox({ type: 'expert', expertId: 'pubmed' })).toHaveLength(1);
            expect(messageBus.getInbox({ type: 'expert', expertId: 'analysis' })).toHaveLength(1);
        });
    });

    describe('subscription', () => {
        it('should notify subscriber when new mail arrives', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            let receivedMail: MailMessage | null = null;

            const listener: IMailListener = {
                async onNewMail(mail) {
                    receivedMail = mail;
                },
            };

            messageBus.subscribe(to, listener);

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Test mail',
            });

            // Wait for async notification
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(receivedMail).not.toBeNull();
            if (!receivedMail) {
                throw new Error('')
            }
            expect((receivedMail as MailMessage).subject).toBe('Test mail');
        });
        it('should allow unsubscribe', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            let callCount = 0;
            const listener: IMailListener = {
                async onNewMail() {
                    callCount++;
                },
            };

            const subscriptionId = messageBus.subscribe(to, listener);

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Mail 1',
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Unsubscribe
            messageBus.unsubscribe(subscriptionId);

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Mail 2',
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Should only receive first mail
            expect(callCount).toBe(1);
        });
    });

    describe('mailbox operations', () => {
        it('should track unread count', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Mail 1',
            });

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Mail 2',
            });

            expect(messageBus.getUnreadCount(to)).toBe(2);

            // Mark one as read
            const inbox = messageBus.getInbox(to);
            await messageBus.markAsRead(inbox[0].messageId);

            expect(messageBus.getUnreadCount(to)).toBe(1);
        });

        it('should delete mail', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            const mail = await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'To be deleted',
            });

            expect(messageBus.getInbox(to)).toHaveLength(1);

            await messageBus.deleteMessage(mail.messageId);

            expect(messageBus.getInbox(to)).toHaveLength(0);
        });

        it('should star mail', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            const mail = await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Important',
            });

            await messageBus.starMessage(mail.messageId);

            const inbox = messageBus.getInbox(to);
            expect(inbox[0].starred).toBe(true);
        });
    });

    describe('search', () => {
        it('should search by subject', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Search for cancer papers',
            });

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Search for diabetes papers',
            });

            const results = messageBus.search({
                subject: 'cancer',
            });

            expect(results).toHaveLength(1);
            expect(results[0].subject).toBe('Search for cancer papers');
        });

        it('should search by sender', async () => {
            const to: MailAddress = { type: 'expert', expertId: 'pubmed' };

            await messageBus.send({
                from: { type: 'mc', mcId: 'main' },
                to,
                subject: 'Task 1',
            });

            await messageBus.send({
                from: { type: 'expert', expertId: 'analysis' },
                to,
                subject: 'Task 2',
            });

            const results = messageBus.search({
                from: { type: 'mc', mcId: 'main' },
            });

            expect(results).toHaveLength(1);
        });
    });
});
