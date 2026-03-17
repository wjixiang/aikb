-- CreateTable
CREATE TABLE "MailMessage" (
    "messageId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "attachments" TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "taskId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[],
    "read" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "RegisteredAddress" (
    "address" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "domain" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RegisteredAddress_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE INDEX "MailMessage_to_idx" ON "MailMessage"("to");

-- CreateIndex
CREATE INDEX "MailMessage_from_idx" ON "MailMessage"("from");

-- CreateIndex
CREATE INDEX "MailMessage_sentAt_idx" ON "MailMessage"("sentAt");

-- CreateIndex
CREATE INDEX "MailMessage_taskId_idx" ON "MailMessage"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredAddress_user_domain_key" ON "RegisteredAddress"("user", "domain");
