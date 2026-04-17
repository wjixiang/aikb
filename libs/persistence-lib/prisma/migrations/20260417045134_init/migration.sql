-- CreateTable
CREATE TABLE "PersistedToolResult" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "toolUseId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersistedToolResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "workspaceContexts" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentState" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "stateData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolResultBlob" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "toolUseId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "preview" TEXT,
    "originalSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolResultBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "abortReason" TEXT,
    "abortSource" TEXT,
    "config" JSONB,
    "name" TEXT,
    "agentType" TEXT,
    "totalTokensIn" INTEGER NOT NULL DEFAULT 0,
    "totalTokensOut" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "toolUsage" JSONB,
    "consecutiveMistakeCount" INTEGER NOT NULL DEFAULT 0,
    "collectedErrors" JSONB,
    "exportResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersistedToolResult_toolUseId_key" ON "PersistedToolResult"("toolUseId");

-- CreateIndex
CREATE INDEX "PersistedToolResult_instanceId_idx" ON "PersistedToolResult"("instanceId");

-- CreateIndex
CREATE INDEX "PersistedToolResult_toolUseId_idx" ON "PersistedToolResult"("toolUseId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_instanceId_key" ON "AgentMemory"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentState_instanceId_componentId_key" ON "ComponentState"("instanceId", "componentId");

-- CreateIndex
CREATE INDEX "ToolResultBlob_instanceId_idx" ON "ToolResultBlob"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolResultBlob_instanceId_toolUseId_key" ON "ToolResultBlob"("instanceId", "toolUseId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_instanceId_key" ON "AgentInstance"("instanceId");

-- CreateIndex
CREATE INDEX "AgentInstance_instanceId_idx" ON "AgentInstance"("instanceId");

-- CreateIndex
CREATE INDEX "AgentInstance_status_idx" ON "AgentInstance"("status");

-- CreateIndex
CREATE INDEX "AgentInstance_agentType_idx" ON "AgentInstance"("agentType");

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AgentInstance"("instanceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentState" ADD CONSTRAINT "ComponentState_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AgentInstance"("instanceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolResultBlob" ADD CONSTRAINT "ToolResultBlob_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AgentInstance"("instanceId") ON DELETE CASCADE ON UPDATE CASCADE;
