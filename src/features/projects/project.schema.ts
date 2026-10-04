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

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  originalScope: z.string().min(1).max(20_000),
  deliverables: z
    .array(z.object({ title: z.string().min(1).max(200) }))
    .max(30)
    .default([]),
  status: projectStatusSchema.default("ACTIVE"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: projectStatusSchema.optional(),
  originalScope: z.string().min(1).max(20_000).optional(),
  currentScope: z.string().min(1).max(20_000).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

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
