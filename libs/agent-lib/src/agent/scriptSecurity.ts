/**
 * Script Security Module
 * 
 * This module provides security mechanisms for safe script execution in the virtual workspace.
 * It implements multiple layers of protection to prevent malicious or unintended script behavior.
 */

import { z } from 'zod';

/**
 * Security configuration options
 */
export interface SecurityConfig {
    /**
     * Maximum execution time in milliseconds
     */
    maxExecutionTime?: number;

    /**
     * Maximum memory usage in MB
     */
    maxMemoryUsage?: number;

    /**
     * Maximum number of loop iterations
     */
    maxIterations?: number;

    /**
     * Whether to allow network requests
     */
    allowNetwork?: boolean;

    /**
     * Whether to allow file system access
     */
    allowFileSystem?: boolean;

    /**
     * Whether to allow process access
     */
    allowProcess?: boolean;

    /**
     * List of allowed global objects
     */
    allowedGlobals?: string[];

    /**
     * List of blocked patterns (regex)
     */
    blockedPatterns?: RegExp[];

    /**
     * Custom validation function
     */
    customValidator?: (script: string) => boolean | Promise<boolean>;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    maxExecutionTime: 5000, // 5 seconds
    maxMemoryUsage: 100, // 100 MB
    maxIterations: 100000,
    allowNetwork: false,
    allowFileSystem: false,
    allowProcess: false,
    allowedGlobals: [
        'Math',
        'Date',
        'JSON',
        'Array',
        'Object',
        'String',
        'Number',
        'Boolean',
        'Promise',
        'console',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
    ],
    blockedPatterns: [
        /require\s*\(/,
        /import\s*\(/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\./,
        /global\./,
        /__dirname/,
        /__filename/,
        /Buffer\./,
        /child_process/,
        /fs\./,
        /http\./,
        /https\./,
        /net\./,
        /dgram\./,
        /cluster/,
        /vm\./,
        /worker_threads/,
    ],
};

/**
 * Script validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Script execution context with security constraints
 */
export class SecureExecutionContext {
    private config: SecurityConfig;
    private executionStartTime: number = 0;
    private iterationCount: number = 0;
    private timeoutId?: NodeJS.Timeout;

    constructor(config: SecurityConfig = {}) {
        this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    }

    /**
     * Validate a script before execution
     */
    async validateScript(script: string): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for blocked patterns
        if (this.config.blockedPatterns) {
            for (const pattern of this.config.blockedPatterns) {
                if (pattern.test(script)) {
                    errors.push(`Blocked pattern detected: ${pattern.source}`);
                }
            }
        }

        // Check script length
        if (script.length > 10000) {
            warnings.push('Script is very long, may affect performance');
        }

        // Check for potential infinite loops
        const loopPatterns = [/while\s*\(\s*true\s*\)/, /for\s*\(\s*;\s*;\s*\)/];
        for (const pattern of loopPatterns) {
            if (pattern.test(script)) {
                warnings.push('Potential infinite loop detected');
            }
        }

        // Custom validation
        if (this.config.customValidator) {
            try {
                const customValid = await this.config.customValidator(script);
                if (!customValid) {
                    errors.push('Custom validation failed');
                }
            } catch (error) {
                errors.push(`Custom validation error: ${error}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Create a sandboxed execution environment
     */
    createSandbox(): Record<string, any> {
        const sandbox: Record<string, any> = {};

        // Add allowed globals
        if (this.config.allowedGlobals) {
            for (const globalName of this.config.allowedGlobals) {
                if (globalName in global) {
                    sandbox[globalName] = (global as any)[globalName];
                }
            }
        }

        // Override setTimeout/clearTimeout for timeout enforcement
        sandbox['setTimeout'] = (callback: Function, delay: number) => {
            if (delay > this.config.maxExecutionTime!) {
                throw new Error(`Timeout exceeds maximum allowed time of ${this.config.maxExecutionTime}ms`);
            }
            return global.setTimeout(callback, delay);
        };

        // Override setInterval for iteration counting
        const originalSetInterval = global.setInterval;
        sandbox['setInterval'] = (callback: Function, delay: number) => {
            if (delay < 10) {
                throw new Error('Interval too short, may cause performance issues');
            }
            return originalSetInterval(callback, delay);
        };

        // Add safe console
        sandbox['console'] = {
            log: (...args: any[]) => console.log('[Script]', ...args),
            warn: (...args: any[]) => console.warn('[Script]', ...args),
            error: (...args: any[]) => console.error('[Script]', ...args),
        };

        return sandbox;
    }

    /**
     * Start execution with timeout enforcement
     */
    startExecution(): void {
        this.executionStartTime = Date.now();
        this.iterationCount = 0;

        // Set up timeout
        if (this.config.maxExecutionTime) {
            this.timeoutId = setTimeout(() => {
                throw new Error(`Script execution timeout: exceeded ${this.config.maxExecutionTime}ms`);
            }, this.config.maxExecutionTime);
        }
    }

    /**
     * Stop execution and cleanup
     */
    stopExecution(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }

    /**
     * Check if execution time limit is exceeded
     */
    checkExecutionTime(): void {
        if (this.config.maxExecutionTime) {
            const elapsed = Date.now() - this.executionStartTime;
            if (elapsed > this.config.maxExecutionTime) {
                throw new Error(`Script execution timeout: exceeded ${this.config.maxExecutionTime}ms`);
            }
        }
    }

    /**
     * Increment iteration counter and check limit
     */
    incrementIteration(): void {
        this.iterationCount++;
        if (this.config.maxIterations && this.iterationCount > this.config.maxIterations) {
            throw new Error(`Maximum iteration count exceeded: ${this.config.maxIterations}`);
        }
    }

    /**
     * Get execution statistics
     */
    getExecutionStats(): { elapsed: number; iterations: number } {
        return {
            elapsed: Date.now() - this.executionStartTime,
            iterations: this.iterationCount,
        };
    }
}

/**
 * Script sanitizer for removing potentially dangerous code
 */
export class ScriptSanitizer {
    /**
     * Sanitize script by removing comments and whitespace
     */
    static sanitize(script: string): string {
        // Remove multi-line comments
        let sanitized = script.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove single-line comments
        sanitized = sanitized.replace(/\/\/.*$/gm, '');

        // Normalize whitespace
        sanitized = sanitized.replace(/\s+/g, ' ').trim();

        return sanitized;
    }

    /**
     * Extract function calls from script for analysis
     */
    static extractFunctionCalls(script: string): string[] {
        const calls: string[] = [];
        const callPattern = /(\w+)\s*\(/g;
        let match;

        while ((match = callPattern.exec(script)) !== null) {
            calls.push(match[1]);
        }

        return [...new Set(calls)];
    }

    /**
     * Analyze script complexity
     */
    static analyzeComplexity(script: string): {
        lines: number;
        statements: number;
        functions: number;
        loops: number;
        conditionals: number;
    } {
        const lines = script.split('\n').length;
        const statements = (script.match(/;/g) || []).length;
        const functions = (script.match(/function\s+\w+/g) || []).length +
            (script.match(/\w+\s*=>\s*{/g) || []).length;
        const loops = (script.match(/\b(for|while|do)\b/g) || []).length;
        const conditionals = (script.match(/\b(if|else|switch|case)\b/g) || []).length;

        return { lines, statements, functions, loops, conditionals };
    }
}

/**
 * Security policy schema for validation
 */
export const SecurityConfigSchema = z.object({
    maxExecutionTime: z.number().positive().optional(),
    maxMemoryUsage: z.number().positive().optional(),
    maxIterations: z.number().positive().optional(),
    allowNetwork: z.boolean().optional(),
    allowFileSystem: z.boolean().optional(),
    allowProcess: z.boolean().optional(),
    allowedGlobals: z.array(z.string()).optional(),
    blockedPatterns: z.array(z.instanceof(RegExp)).optional(),
    customValidator: z.function().args(z.string()).returns(z.union([z.boolean(), z.promise(z.boolean())])).optional(),
});

/**
 * Create a security configuration from a partial config
 */
export function createSecurityConfig(config: Partial<SecurityConfig> = {}): SecurityConfig {
    return SecurityConfigSchema.parse({ ...DEFAULT_SECURITY_CONFIG, ...config }) as SecurityConfig;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: any): config is SecurityConfig {
    return SecurityConfigSchema.safeParse(config).success;
}
