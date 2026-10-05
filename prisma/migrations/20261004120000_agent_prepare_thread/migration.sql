-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'WAITING_CLIENT', 'DRAFT_READY', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ThreadMessageKind" AS ENUM ('SYSTEM', 'CLIENT_REQUEST', 'CLARIFICATION_DRAFT', 'CLARIFICATION_QUESTION', 'CLIENT_ANSWER', 'ACTIVITY', 'DRAFT_SUMMARY');

-- CreateEnum
CREATE TYPE "ThreadMessageVisibility" AS ENUM ('SHARED', 'PRIVATE');

-- CreateTable
CREATE TABLE "ChangeThread" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "autoClarify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" "ThreadMessageKind" NOT NULL,
    "visibility" "ThreadMessageVisibility" NOT NULL DEFAULT 'SHARED',
    "body" TEXT NOT NULL,
    "metadataJson" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "maxSteps" INTEGER NOT NULL DEFAULT 12,
    "agreementVersionAtStart" INTEGER NOT NULL,
    "agreementVersionChecked" INTEGER,
    "analysisSnapshotJson" JSONB,
    "pendingClarificationJson" JSONB,
    "draftStale" BOOLEAN NOT NULL DEFAULT false,
    "needsReviewReason" TEXT,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" JSONB,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeThread_changeRequestId_key" ON "ChangeThread"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeThread_inviteToken_key" ON "ChangeThread"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeThreadMessage_threadId_idempotencyKey_key" ON "ChangeThreadMessage"("threadId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ChangeThreadMessage_threadId_createdAt_idx" ON "ChangeThreadMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_changeRequestId_status_idx" ON "AgentRun"("changeRequestId", "status");

-- CreateIndex
CREATE INDEX "AgentRun_status_updatedAt_idx" ON "AgentRun"("status", "updatedAt");

-- One active prepare-run per change (queued / running / waiting).
CREATE UNIQUE INDEX "AgentRun_one_active_per_change" ON "AgentRun"("changeRequestId")
WHERE "status" IN ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'WAITING_CLIENT');

-- CreateIndex
CREATE INDEX "AgentJob_status_availableAt_idx" ON "AgentJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "AgentJob_runId_status_idx" ON "AgentJob"("runId", "status");

-- AddForeignKey
ALTER TABLE "ChangeThread" ADD CONSTRAINT "ChangeThread_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeThreadMessage" ADD CONSTRAINT "ChangeThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChangeThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChangeThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
