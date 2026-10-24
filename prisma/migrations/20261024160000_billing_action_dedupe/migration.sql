-- Two app instances (e.g. during a redeploy) run the billing sweep against the
-- same database. These indexes make duplicate drafts impossible.

-- At most one pending payment follow-up step per proposal.
CREATE UNIQUE INDEX "BillingAgentAction_one_pending_step"
  ON "BillingAgentAction" ("proposalId")
  WHERE status = 'PROPOSED' AND tool <> 'send_payout';

-- At most one pending or sent payout per subcontractor per change.
CREATE UNIQUE INDEX "BillingAgentAction_one_payout_per_subcontractor"
  ON "BillingAgentAction" ("proposalId", "subcontractorId")
  WHERE tool = 'send_payout' AND status IN ('PROPOSED', 'EXECUTED');
