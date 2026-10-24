-- CreateEnum
CREATE TYPE "BillingActionStatus" AS ENUM ('PROPOSED', 'EXECUTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "BillingAgentAction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "argsJson" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "BillingActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "paypalInvoiceId" TEXT,
    "resultJson" JSONB,
    "error" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingAgentAction_proposalId_createdAt_idx" ON "BillingAgentAction"("proposalId", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingAgentAction" ADD CONSTRAINT "BillingAgentAction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
