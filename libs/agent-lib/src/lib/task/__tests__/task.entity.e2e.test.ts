import { ProviderSettings } from "@/libs/llm-types/src";
import { Task } from "../task.entity";
import { ApiStreamChunk } from "llm-api";

describe('integrated', () => {
    const testApiConfig: ProviderSettings = {
        apiProvider: 'zai',
        apiKey: process.env['GLM_API_KEY'],
        apiModelId: 'glm-4.6',
        zaiApiLine: 'china_coding'
    };

    it('should create a new task successfully', async () => {
        const newTask = new Task('test_task_id_1', testApiConfig);
        expect(newTask.taskId).toBe('test_task_id_1');
    });

    it('should execute a simple task', async () => {
        const newTask = new Task('test_task_id_1', testApiConfig);

        // Add a user message to the conversation history first
        await newTask.recursivelyMakeClineRequests([{
            type: 'text', text: 'hi!'
        }]);

        // Test that we can make a simple API request
        const stream = newTask['attemptApiRequest']();
        const chunks: ApiStreamChunk[] = [];
    })
    //     for await (const chunk of stream) {
    //         chunks.push(chunk);
    //         if (chunk.type === 'text' || chunk.type === 'reasoning') {
    //             // We've received some content, that's enough to verify the API works
    //             break;
    //         }
    //     }

    //     expect(chunks.length).toBeGreaterThan(0);
    //     expect(chunks[0].type).toMatch(/text|reasoning/);
    // }, 30000)

    it.todo('should handle api request failure with retry mechanism')
    it('should use simple tool correctly', async () => {

    })
});