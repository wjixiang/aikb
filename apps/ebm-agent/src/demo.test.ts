import { describe, it, expect } from 'vitest';
import config from '../experts/hi-agent/index.js';

describe('Demo Expert', () => {
    it('should load config', () => {
        console.log('Config:', JSON.stringify(config, null, 2));
        expect(config).toBeDefined();
    });
});
