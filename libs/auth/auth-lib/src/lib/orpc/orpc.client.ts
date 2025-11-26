import type { JsonifiedClient } from '@orpc/openapi-client'
import type { ContractRouterClient } from '@orpc/contract'
import { createORPCClient } from '@orpc/client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { authContract } from './orpc.contract'

const link = new OpenAPILink(authContract, {
  url: process.env['AUTH_SERVICE_ENDPOINT'] as string|'http://localhost:3000',
  headers: () => ({
    
  }),
  // fetch: <-- polyfill fetch if needed
})

export const orpc_client: JsonifiedClient<ContractRouterClient<typeof authContract>> = createORPCClient(link)