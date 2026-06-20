import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** Server-side validation of the incoming project request (never trust input). */
export const projectRequestSchema = z.object({
  discordId: z.string().trim().min(1).max(40),
  username: z.string().trim().min(1).max(120),
  avatarUrl: z.preprocess(emptyToUndefined, z.string().url().max(400).optional()),
  projectType: z.string().trim().min(1).max(100),
  budget: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  contact: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  message: z.string().trim().min(1).max(4000),
  createdAt: z.string().trim().min(1).max(40),
  accessToken: z.string().max(200).optional(),
});

export type ValidatedProjectRequest = z.infer<typeof projectRequestSchema>;
