-- Agentic workspace: client request links, AI project summaries,
-- client email captured at acceptance, and invoice-backed payments.
ALTER TABLE "Project" ADD COLUMN "intakeToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummaryAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Project_intakeToken_key" ON "Project"("intakeToken");

ALTER TABLE "Acceptance" ADD COLUMN "clientEmail" TEXT;

ALTER TABLE "Payment" ADD COLUMN "paypalInvoiceId" TEXT;
CREATE UNIQUE INDEX "Payment_paypalInvoiceId_key" ON "Payment"("paypalInvoiceId");
