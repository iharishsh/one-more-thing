-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "revisionRoundsTotal" INTEGER,
ADD COLUMN     "revisionRoundsUsed" INTEGER NOT NULL DEFAULT 0;
