import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { syncFileToDb, getPrismaClient, closePrismaClient } from './db-storage.js';
import { PrismaClient } from '../generated/prisma/client.js';

describe('db-storage tests', () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
        prisma = getPrismaClient();
    });

    afterAll(async () => {
        await closePrismaClient();
    });


});
