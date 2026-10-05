-- AlterEnum
ALTER TYPE "ThreadMessageKind" ADD VALUE 'FREELANCER_NOTE';

-- AlterTable
ALTER TABLE "ChangeRequest" ADD COLUMN     "discussionNotes" TEXT,
ADD COLUMN     "discussedPriceCents" INTEGER,
ADD COLUMN     "discussedDeliveryNote" TEXT,
ADD COLUMN     "analysisRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN "inputRevision" INTEGER NOT NULL DEFAULT 0;
