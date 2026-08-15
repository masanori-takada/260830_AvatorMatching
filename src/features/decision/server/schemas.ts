import { z } from "zod";

export const matchRunIdSchema = z.uuid();

export const decisionInputSchema = z.object({
  matchRunId: matchRunIdSchema,
  kind: z.enum(["accept", "decline"]),
});

export type DecisionInput = z.infer<typeof decisionInputSchema>;
