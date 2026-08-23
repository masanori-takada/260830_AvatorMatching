import { z } from "zod";

export const connectionIdSchema = z.uuid();

export const contactDecisionInputSchema = z.object({
  connectionId: connectionIdSchema,
  kind: z.enum(["accept", "decline"]),
});

export type ContactDecisionInput = z.infer<typeof contactDecisionInputSchema>;

