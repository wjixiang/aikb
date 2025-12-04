import { populateContractRouterPaths } from '@orpc/nest'
import { oc } from '@orpc/contract'
import * as z from 'zod'
import { CreateEntityDto } from '../dto'

export const CreateEntityContract = oc
    .route({
        method: 'POST',
        path: '/entities'
    })
    .input(z.object({
        nomenclature: z.array(z.object({
            name: z.string(),
            acronym: z.string().optional(),
            language: z.enum(['en', 'zh'])
        })),
        abstract: z.object({
            description: z.string()
        })
    }))
    .output(z.object({
        id: z.string(),
        nomenclature: z.array(z.object({
            name: z.string(),
            acronym: z.string().nullable(),
            language: z.enum(['en', 'zh'])
        })),
        abstract: z.object({
            description: z.string(),
            embedding: z.object({
                config: z.object({
                    model: z.string(),
                    dimension: z.number(),
                    batchSize: z.number(),
                    maxRetries: z.number(),
                    timeout: z.number(),
                    provider: z.string()
                }),
                vector: z.array(z.number())
            }).optional()
        })
    }))

export const contract = populateContractRouterPaths({
    
})