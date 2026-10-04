-- AlterEnum
ALTER TYPE "ProposalStatus" ADD VALUE 'DECLINED';
ALTER TYPE "ProposalStatus" ADD VALUE 'CHANGES_REQUESTED';

CREATE TYPE "ClientResponseAction" AS ENUM ('DECLINE', 'REQUEST_CHANGES');

ALTER TABLE "User" ADD COLUMN "authSubject" TEXT;
CREATE UNIQUE INDEX "User_authSubject_key" ON "User"("authSubject");

ALTER TABLE "Payment" ADD COLUMN "proposalVersion" INTEGER;
UPDATE "Payment" p
SET "proposalVersion" = pr.version
FROM "Proposal" pr
WHERE p."proposalId" = pr.id;
UPDATE "Payment" SET "proposalVersion" = 1 WHERE "proposalVersion" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "proposalVersion" SET NOT NULL;

ALTER TABLE "WebhookEvent" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WebhookEvent" ADD COLUMN "lastError" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE TABLE "ClientResponse" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "proposalVersion" INTEGER NOT NULL,
    "action" "ClientResponseAction" NOT NULL,
    "message" TEXT,
    "clientName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientResponse_proposalId_createdAt_idx" ON "ClientResponse"("proposalId", "createdAt");

ALTER TABLE "ClientResponse" ADD CONSTRAINT "ClientResponse_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Deliverable_proposalId_idx" ON "Deliverable"("proposalId");
