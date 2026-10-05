import { z } from "zod";

export const AGENT_JOB_PROCESS = "PROCESS_RUN";
export const AGENT_JOB_RESUME = "RESUME_AFTER_ANSWER";

export const MAX_AGENT_STEPS = 12;
export const MAX_AGENT_JOB_ATTEMPTS = 5;
export const AGENT_RUN_TIMEOUT_MS = 90_000;

export const pendingClarificationSchema = z.object({
  question: z.string().min(1),
  relatedClaims: z.array(z.string()).default([]),
  relatedItemIds: z.array(z.string()).default([]),
  draftMessageId: z.string().optional(),
  publishedMessageId: z.string().optional(),
});

export type PendingClarification = z.infer<typeof pendingClarificationSchema>;

export const approveClarificationSchema = z.object({
  editedQuestion: z.string().min(1).optional(),
});

export const clientAnswerSchema = z.object({
  answer: z.string().min(1).max(4000),
  /** Client-supplied key so retries do not double-submit. */
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const ACTIVE_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING_APPROVAL",
  "WAITING_CLIENT",
] as const;
