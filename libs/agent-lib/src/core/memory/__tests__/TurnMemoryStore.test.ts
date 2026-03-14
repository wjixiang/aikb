import { describe, it, expect, beforeEach } from 'vitest';
import { TurnMemoryStore } from '../TurnMemoryStore';
import { TurnStatus } from '../Turn';
import { MessageBuilder } from '../../task/task.type';

describe('TurnMemoryStore', () => {
    let store: TurnMemoryStore;

    beforeEach(() => {
        store = new TurnMemoryStore();
    });

    describe('createTurn', () => {
        it('should create a new turn with correct initial state', () => {
            const turn = store.createTurn('test workspace context');

            expect(turn.turnNumber).toBe(1);
            expect(turn.status).toBe(TurnStatus.PENDING);
            expect(turn.messages).toEqual([]);
            expect(turn.workspaceContext).toBe('test workspace context');
            expect(turn.toolCalls).toEqual([]);
            expect(turn.tokenUsage.total).toBe(0);
        });

        it('should increment turn number for each new turn', () => {
            const turn1 = store.createTurn('context 1');
            const turn2 = store.createTurn('context 2');
            const turn3 = store.createTurn('context 3');

            expect(turn1.turnNumber).toBe(1);
            expect(turn2.turnNumber).toBe(2);
            expect(turn3.turnNumber).toBe(3);
        });
    });

    describe('updateTurnStatus', () => {
        it('should update turn status', () => {
            const turn = store.createTurn('test context');

            store.updateTurnStatus(turn.id, TurnStatus.THINKING);
            expect(store.getTurn(turn.id)?.status).toBe(TurnStatus.THINKING);

            store.updateTurnStatus(turn.id, TurnStatus.COMPLETED);
            expect(store.getTurn(turn.id)?.status).toBe(TurnStatus.COMPLETED);
        });

        it('should throw error for non-existent turn', () => {
            expect(() => {
                store.updateTurnStatus('invalid-id', TurnStatus.COMPLETED);
            }).toThrow('Turn invalid-id not found');
        });
    });

    describe('addMessageToTurn', () => {
        it('should add messages to turn', () => {
            const turn = store.createTurn('test context');

            store.addMessageToTurn(turn.id, MessageBuilder.user('Hello'));
            store.addMessageToTurn(turn.id, MessageBuilder.assistant('Hi there'));

            const messages = store.getTurn(turn.id)?.messages;
            expect(messages).toHaveLength(2);
            expect(messages?.[0].role).toBe('user');
            expect(messages?.[1].role).toBe('assistant');
        });

        it('should add timestamp to messages', () => {
            const turn = store.createTurn('test context');
            store.addMessageToTurn(turn.id, MessageBuilder.user('Hello'));

            const message = store.getTurn(turn.id)?.messages[0];
            expect(message?.ts).toBeDefined();
            expect(typeof message?.ts).toBe('number');
        });
    });

    describe('storeThinkingPhase', () => {
        it('should store thinking phase results', () => {
            const turn = store.createTurn('test context');

            const rounds = [
                {
                    roundNumber: 1,
                    content: 'thinking...',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 100,
                },
            ];

            store.storeThinkingPhase(turn.id, rounds, 100);

            const updatedTurn = store.getTurn(turn.id);
            expect(updatedTurn?.thinkingPhase?.rounds).toEqual(rounds);
            expect(updatedTurn?.thinkingPhase?.tokensUsed).toBe(100);
            expect(updatedTurn?.tokenUsage.thinking).toBe(100);
            expect(updatedTurn?.tokenUsage.total).toBe(100);
        });
    });

    describe('addToolCallResult', () => {
        it('should add tool call results', () => {
            const turn = store.createTurn('test context');

            store.addToolCallResult(turn.id, {
                toolName: 'test_tool',
                success: true,
                result: 'success',
                timestamp: Date.now(),
            });

            const toolCalls = store.getTurn(turn.id)?.toolCalls;
            expect(toolCalls).toHaveLength(1);
            expect(toolCalls?.[0].toolName).toBe('test_tool');
            expect(toolCalls?.[0].success).toBe(true);
        });
    });

    describe('storeSummary', () => {
        it('should store summary and insights', () => {
            const turn = store.createTurn('test context');

            store.storeSummary(turn.id, 'Test summary', ['insight 1', 'insight 2']);

            const updatedTurn = store.getTurn(turn.id);
            expect(updatedTurn?.summary).toBe('Test summary');
            expect(updatedTurn?.insights).toEqual(['insight 1', 'insight 2']);
        });
    });

    describe('getTurn and getTurnByNumber', () => {
        it('should retrieve turn by ID', () => {
            const turn = store.createTurn('test context');
            const retrieved = store.getTurn(turn.id);

            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(turn.id);
        });

        it('should retrieve turn by number', () => {
            store.createTurn('context 1');
            const turn2 = store.createTurn('context 2');

            const retrieved = store.getTurnByNumber(2);
            expect(retrieved?.id).toBe(turn2.id);
        });

        it('should return undefined for non-existent turn', () => {
            expect(store.getTurn('invalid-id')).toBeUndefined();
            expect(store.getTurnByNumber(999)).toBeUndefined();
        });
    });

    describe('getAllTurns and getRecentTurns', () => {
        it('should get all turns in chronological order', () => {
            store.createTurn('context 1');
            store.createTurn('context 2');
            store.createTurn('context 3');

            const allTurns = store.getAllTurns();
            expect(allTurns).toHaveLength(3);
            expect(allTurns[0].turnNumber).toBe(1);
            expect(allTurns[1].turnNumber).toBe(2);
            expect(allTurns[2].turnNumber).toBe(3);
        });

        it('should get recent turns', () => {
            store.createTurn('context 1');
            store.createTurn('context 2');
            store.createTurn('context 3');
            store.createTurn('context 4');

            const recentTurns = store.getRecentTurns(2);
            expect(recentTurns).toHaveLength(2);
            expect(recentTurns[0].turnNumber).toBe(3);
            expect(recentTurns[1].turnNumber).toBe(4);
        });
    });

    describe('getAllMessages and getRecentMessages', () => {
        it('should get all messages from all turns', () => {
            const turn1 = store.createTurn('context 1');
            store.addMessageToTurn(turn1.id, MessageBuilder.user('msg 1'));
            store.addMessageToTurn(turn1.id, MessageBuilder.assistant('msg 2'));

            const turn2 = store.createTurn('context 2');
            store.addMessageToTurn(turn2.id, MessageBuilder.user('msg 3'));

            const allMessages = store.getAllMessages();
            expect(allMessages).toHaveLength(3);
        });

        it('should get recent messages from last N turns', () => {
            const turn1 = store.createTurn('context 1');
            store.addMessageToTurn(turn1.id, MessageBuilder.user('msg 1'));

            const turn2 = store.createTurn('context 2');
            store.addMessageToTurn(turn2.id, MessageBuilder.user('msg 2'));

            const turn3 = store.createTurn('context 3');
            store.addMessageToTurn(turn3.id, MessageBuilder.user('msg 3'));

            const recentMessages = store.getRecentMessages(2);
            expect(recentMessages).toHaveLength(2);
        });
    });

    describe('searchTurns', () => {
        it('should search turns by keyword in summary', () => {
            const turn1 = store.createTurn('context 1');
            store.storeSummary(turn1.id, 'This is about authentication', []);

            const turn2 = store.createTurn('context 2');
            store.storeSummary(turn2.id, 'This is about database', []);

            const results = store.searchTurns('authentication');
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(turn1.id);
        });

        it('should search turns by keyword in insights', () => {
            const turn1 = store.createTurn('context 1');
            store.storeSummary(turn1.id, 'Summary', ['user login', 'password reset']);

            const results = store.searchTurns('password');
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(turn1.id);
        });
    });

    describe('export and import', () => {
        it('should export and import memory state', () => {
            const turn1 = store.createTurn('context 1');
            store.addMessageToTurn(turn1.id, MessageBuilder.user('Hello'));
            store.storeSummary(turn1.id, 'Summary 1', []);

            const turn2 = store.createTurn('context 2');
            store.addMessageToTurn(turn2.id, MessageBuilder.user('World'));

            const exported = store.export();

            const newStore = new TurnMemoryStore();
            newStore.import(exported);

            expect(newStore.getCurrentTurnNumber()).toBe(2);
            expect(newStore.getAllTurns()).toHaveLength(2);
            expect(newStore.getTurnByNumber(1)?.summary).toBe('Summary 1');
        });
    });

    describe('clear', () => {
        it('should clear all data', () => {
            store.createTurn('context 1');
            store.createTurn('context 2');

            store.clear();

            expect(store.getCurrentTurnNumber()).toBe(0);
            expect(store.getAllTurns()).toHaveLength(0);
        });
    });
});
