-- Structured agreement status (replaces prose markers in currentScope).

CREATE TYPE "AgreementStatus" AS ENUM ('UNCONFIRMED', 'FREELANCER_RECORDED', 'CLIENT_ACCEPTED');

ALTER TABLE "Project" ADD COLUMN "agreementStatus" "AgreementStatus" NOT NULL DEFAULT 'FREELANCER_RECORDED';
ALTER TABLE "Project" ADD COLUMN "agreementSource" TEXT;
ALTER TABLE "Project" ADD COLUMN "agreementRecordedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "openingRequest" TEXT;

-- Migrate legacy provisional marker text → structured UNCONFIRMED + opening request.
UPDATE "Project"
SET
  "agreementStatus" = 'UNCONFIRMED',
  "openingRequest" = COALESCE(
    NULLIF(
      TRIM(
        substring(
          "currentScope"
          from 'Client''s opening request \(proposed work, not approved(?: yet)?\):\s*([\s\S]*?)(?:\n\nWhat|$)'
        )
      ),
      ''
    ),
    NULLIF(TRIM("originalScope"), ''),
    'Opening request'
  ),
  "originalScope" = COALESCE(
    NULLIF(
      TRIM(
        substring(
          "currentScope"
          from 'Client''s opening request \(proposed work, not approved(?: yet)?\):\s*([\s\S]*?)(?:\n\nWhat|$)'
        )
      ),
      ''
    ),
    "originalScope"
  ),
  "currentScope" = ''
WHERE "currentScope" LIKE '%PROVISIONAL AGREEMENT%';

CREATE INDEX "Project_ownerId_agreementStatus_idx" ON "Project"("ownerId", "agreementStatus");
