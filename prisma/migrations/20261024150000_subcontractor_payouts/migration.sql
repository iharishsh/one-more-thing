-- Subcontractor payouts: who gets a share of each paid change.
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paypalEmail" TEXT NOT NULL,
    "sharePercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subcontractor_projectId_idx" ON "Subcontractor"("projectId");
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Default-deny for the publishable key, like every other table.
ALTER TABLE public."Subcontractor" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "BillingAgentAction" ADD COLUMN "subcontractorId" TEXT;
