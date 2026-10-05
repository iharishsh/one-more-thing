import { z } from "zod";

export const projectStatusSchema = z.enum([
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
]);

export type ProjectStatusValue = z.infer<typeof projectStatusSchema>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatusValue, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const agreementStatusSchema = z.enum([
  "UNCONFIRMED",
  "FREELANCER_RECORDED",
  "CLIENT_ACCEPTED",
]);

export type AgreementStatusValue = z.infer<typeof agreementStatusSchema>;

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatusValue, string> = {
  UNCONFIRMED: "No agreement yet",
  FREELANCER_RECORDED: "Recorded by you",
  CLIENT_ACCEPTED: "Accepted by client",
};

export const createProjectSchema = z
  .object({
    title: z.string().min(1).max(200),
    originalScope: z.string().max(20_000).default(""),
    openingRequest: z.string().max(20_000).optional(),
    agreementStatus: agreementStatusSchema.optional(),
    agreementSource: z.string().max(500).optional(),
    agreementRecordedAt: z.string().max(40).optional(),
    deliverables: z
      .array(z.object({ title: z.string().min(1).max(200) }))
      .max(30)
      .default([]),
    status: projectStatusSchema.default("ACTIVE"),
  })
  .superRefine((val, ctx) => {
    const status = val.agreementStatus ?? "FREELANCER_RECORDED";
    if (status === "UNCONFIRMED") {
      const opening = (val.openingRequest ?? val.originalScope).trim();
      if (!opening) {
        ctx.addIssue({
          code: "custom",
          message: "Opening request is required when there is no agreement yet",
          path: ["openingRequest"],
        });
      }
      return;
    }
    if (!val.originalScope.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Agreement text is required",
        path: ["originalScope"],
      });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: projectStatusSchema.optional(),
  originalScope: z.string().min(1).max(20_000).optional(),
  currentScope: z.string().max(20_000).optional(),
  openingRequest: z.string().max(20_000).optional(),
  agreementStatus: agreementStatusSchema.optional(),
  agreementSource: z.string().max(500).nullable().optional(),
  agreementRecordedAt: z.string().max(40).nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const recordExistingAgreementSchema = z.object({
  currentScope: z.string().min(1).max(20_000),
  agreementSource: z.string().min(1).max(500),
  agreementRecordedAt: z.string().min(1).max(40),
  deliverables: z
    .array(z.object({ title: z.string().min(1).max(200) }))
    .max(30)
    .optional(),
});

export type RecordExistingAgreementInput = z.infer<
  typeof recordExistingAgreementSchema
>;

export const refineProjectDraftSchema = z.object({
  title: z.string().max(200).default(""),
  originalScope: z.string().max(20_000).default(""),
  deliverablesText: z.string().max(5_000).default(""),
});

export type RefineProjectDraftInput = z.infer<typeof refineProjectDraftSchema>;

export const refineProjectDraftResultSchema = z.object({
  title: z.string().min(1).max(200),
  originalScope: z.string().min(1).max(20_000),
  deliverables: z.array(z.string().min(1).max(200)).max(30),
  notes: z.string().optional(),
});

export type RefineProjectDraftResult = z.infer<
  typeof refineProjectDraftResultSchema
>;
