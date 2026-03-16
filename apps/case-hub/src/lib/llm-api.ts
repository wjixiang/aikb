import { config } from 'dotenv'
config()
import { ApiClientFactory } from 'agent-lib'

const API_KEY = process.env.MINIMAX_API_KEY || ''

export function getApiClient() {
    const client = ApiClientFactory.create({
        apiProvider: 'minimax',
        apiModelId: 'MiniMax-M2.5',
        apiKey: API_KEY
    })

    return client
}