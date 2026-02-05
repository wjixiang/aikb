import { HttpsProxyAgent } from 'https-proxy-agent';
import axios, { AxiosInstance } from 'axios';

/**
 * Proxy configuration
 */
export interface ProxyConfig {
    url: string;
    username?: string;
    password?: string;
}

/**
 * Proxy pool options
 */
export interface ProxyPoolOptions {
    proxies: ProxyConfig[];
    retryOnProxyError?: boolean;
    maxRetries?: number;
}

/**
 * Proxy pool for managing multiple proxy servers
 */
export class ProxyPool {
    private proxies: ProxyConfig[];
    private currentIndex: number = 0;
    private retryOnProxyError: boolean;
    private maxRetries: number;

    constructor(options: ProxyPoolOptions) {
        this.proxies = options.proxies;
        this.retryOnProxyError = options.retryOnProxyError ?? true;
        this.maxRetries = options.maxRetries ?? 3;
    }

    /**
     * Get the next proxy in round-robin fashion
     */
    getNextProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            return null;
        }

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    /**
     * Create an axios instance with proxy support
     */
    createAxiosInstance(baseURL: string): AxiosInstance {
        const instance = axios.create({
            baseURL,
            httpAgent: this.createAgent(),
            httpsAgent: this.createAgent(),
        });

        // Add request interceptor to set proxy for each request
        instance.interceptors.request.use((config) => {
            const proxy = this.getNextProxy();
            if (proxy) {
                const agent = this.createAgent(proxy);
                config.httpAgent = agent;
                config.httpsAgent = agent;
            }
            return config;
        });

        // Add response interceptor to handle proxy errors
        if (this.retryOnProxyError) {
            instance.interceptors.response.use(
                (response) => response,
                async (error) => {
                    if (this.isProxyError(error)) {
                        // Retry with next proxy
                        const proxy = this.getNextProxy();
                        if (proxy) {
                            const agent = this.createAgent(proxy);
                            error.config.httpAgent = agent;
                            error.config.httpsAgent = agent;
                            return instance.request(error.config);
                        }
                    }
                    return Promise.reject(error);
                }
            );
        }

        return instance;
    }

    /**
     * Create a proxy agent from config
     */
    private createAgent(proxy?: ProxyConfig): HttpsProxyAgent<string> | undefined {
        const config = proxy || this.getNextProxy();
        if (!config) {
            return undefined;
        }

        let proxyUrl = config.url;
        if (config.username && config.password) {
            const url = new URL(config.url);
            url.username = config.username;
            url.password = config.password;
            proxyUrl = url.toString();
        }

        return new HttpsProxyAgent(proxyUrl);
    }

    /**
     * Check if error is proxy-related
     */
    private isProxyError(error: any): boolean {
        if (!error) return false;

        // Check for common proxy error codes
        if (error.response) {
            const status = error.response.status;
            return status === 407 || // Proxy Authentication Required
                status === 502 || // Bad Gateway
                status === 503 || // Service Unavailable
                status === 504;    // Gateway Timeout
        }

        // Check for network errors
        if (error.code) {
            return error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ECONNRESET';
        }

        return false;
    }

    /**
     * Get number of proxies in pool
     */
    get size(): number {
        return this.proxies.length;
    }
}

/**
 * Create a proxy pool from environment variables
 * Expects PROXY_LIST environment variable with comma-separated URLs
 * Optional: PROXY_USERNAME and PROXY_PASSWORD for authentication
 */
export function createProxyPoolFromEnv(): ProxyPool | null {
    const proxyList = process.env['PROXY_LIST'];
    if (!proxyList) {
        return null;
    }

    const proxies: ProxyConfig[] = proxyList
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0)
        .map(url => ({
            url,
            username: process.env['PROXY_USERNAME'],
            password: process.env['PROXY_PASSWORD'],
        }));

    if (proxies.length === 0) {
        return null;
    }

    return new ProxyPool({
        proxies,
        retryOnProxyError: true,
        maxRetries: 3,
    });
}
