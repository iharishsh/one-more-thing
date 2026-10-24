-- New table created after the RLS sweep — keep anon/authenticated default-deny.
ALTER TABLE public."BillingAgentAction" ENABLE ROW LEVEL SECURITY;
