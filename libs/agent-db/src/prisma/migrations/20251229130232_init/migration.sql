-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('idle', 'running', 'completed', 'aborted');

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "TaskStatus" NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "consecutiveMistakeCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveMistakeLimit" INTEGER NOT NULL DEFAULT 3,
    "total_tokens_in" INTEGER NOT NULL DEFAULT 0,
    "total_tokens_out" INTEGER NOT NULL DEFAULT 0,
    "total_cache_writes" INTEGER NOT NULL DEFAULT 0,
    "total_cache_reads" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "context_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL,
    "reasoning" TEXT,
    "timestamp" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_key" ON "Task"("id");

-- CreateIndex
CREATE INDEX "conversation_messages_task_id_idx" ON "conversation_messages"("task_id");

-- CreateIndex
CREATE INDEX "conversation_messages_timestamp_idx" ON "conversation_messages"("timestamp");

-- CreateIndex
CREATE INDEX "task_errors_task_id_idx" ON "task_errors"("task_id");

-- CreateIndex
CREATE INDEX "task_errors_code_idx" ON "task_errors"("code");

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_errors" ADD CONSTRAINT "task_errors_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
