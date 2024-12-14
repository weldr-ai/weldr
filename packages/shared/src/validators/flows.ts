import { z } from "zod";
import { inputSchema, outputSchema } from "./common";
import { conversationSchema } from "./conversations";

export const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  inputSchema: inputSchema.nullable().optional(),
  outputSchema: outputSchema.nullable().optional(),
  code: z.string().nullable().optional(),
  isUpdated: z.boolean().optional(),
  canRun: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  workspaceId: z.string(),
  inputConversationId: z.string(),
  outputConversationId: z.string(),
  inputConversation: conversationSchema,
  outputConversation: conversationSchema,
});

export const insertFlowSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required.",
  }),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const updateFlowSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .optional(),
    description: z.string().optional(),
    inputSchema: inputSchema.optional(),
    validationSchema: z.string().optional(),
    outputSchema: outputSchema.optional(),
    code: z.string().optional(),
  }),
});
