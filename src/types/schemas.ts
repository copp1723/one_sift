import { z } from 'zod';
import { IngestionMode, LeadStatus } from './database.js';

// Request validation schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  ingestionMode: z.nativeEnum(IngestionMode),
  handoverEmail: z.string().email(),
  handoverThreshold: z.number().int().min(1).max(10).default(3),
  metadata: z.record(z.any()).optional().default({})
});

export const updateCustomerSchema = createCustomerSchema.partial().omit({ slug: true });

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(255),
  systemPrompt: z.string().min(1),
  promptVariables: z.record(z.any()).default({}),
  responseSchema: z.record(z.any()).default({
    type: "object",
    properties: {
      answer: { type: "string" },
      follow_up: { type: "string" },
      escalate: { type: "boolean" }
    }
  }),
  config: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxResponseLength: z.number().int().positive().optional(),
    escalationKeywords: z.array(z.string()).optional()
  }).optional().default({}),
  isDefault: z.boolean().default(false)
});

export const updatePersonaSchema = createPersonaSchema.partial();

export const ingestLeadSchema = z.object({
  externalId: z.string().optional(),
  source: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/).optional(),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
  rawData: z.any().optional()
});

// Email webhook schema with improved validation
export const mailgunWebhookSchema = z.object({
  recipient: z.string().email(),
  sender: z.string().email(),
  subject: z.string(),
  'body-plain': z.string(),
  'body-html': z.string().optional(),
  attachments: z.array(z.any()).optional().default([]),
  timestamp: z.string(),
  token: z.string(),
  signature: z.string()
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const leadFilterSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.string().optional(),
  customerEmail: z.string().email().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
}).merge(paginationSchema);

export const conversationFilterSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
}).merge(paginationSchema);

// Message schema
export const createMessageSchema = z.object({
  content: z.string().min(1),
  metadata: z.record(z.any()).optional().default({})
});

// Export type inference helpers
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;
export type UpdatePersonaInput = z.infer<typeof updatePersonaSchema>;
export type IngestLeadInput = z.infer<typeof ingestLeadSchema>;
export type MailgunWebhookInput = z.infer<typeof mailgunWebhookSchema>;
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;
export type ConversationFilterInput = z.infer<typeof conversationFilterSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
