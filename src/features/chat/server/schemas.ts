import { z } from "zod";

export const chatConnectionIdSchema = z.uuid();

export const chatMessageInputSchema = z.object({
  connectionId: chatConnectionIdSchema,
  text: z.string().trim().min(1).max(1000),
});

export type ChatMessageInput = z.infer<typeof chatMessageInputSchema>;

