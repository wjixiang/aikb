import type { JsonifiedClient } from '@orpc/openapi-client';
import type { ContractRouterClient } from '@orpc/contract';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { authContract } from '../../../../libs/auth/auth-lib/src/lib/orpc/orpc.contract';

// Configure ORPC client for e2e tests
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ?? '3000';
const baseUrl = `http://${host}:${port}`;

// Store current auth token for requests
let currentAuthToken: string | null = null;

const link = new OpenAPILink(authContract, {
  url: baseUrl,
  headers: () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if we have a token
    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }

    return headers;
  },
});

export const orpc_client: JsonifiedClient<
  ContractRouterClient<typeof authContract>
> = createORPCClient(link);

// Helper function to set auth token
export const setAuthToken = (token: string) => {
  currentAuthToken = token;
  console.log(`ORPC client: Auth token set`);
};

// Helper function to clear auth token
export const clearAuthToken = () => {
  currentAuthToken = null;
  console.log(`ORPC client: Auth token cleared`);
};

console.log(`ORPC client configured with baseURL: ${baseUrl}`);
