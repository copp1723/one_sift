import { z } from 'zod';
import { IngestionMode } from '../db/schema.js';

// Customer API types
export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  ingestionMode: z.nativeEnum(IngestionMode),
  handoverEmail: z.string().email(),
  handoverThreshold: z.number().min(0).max(1).default(0.7),
  metadata: z.record(z.any()).default({})
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.omit({ slug: true }).partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

// Lead API types
export const IngestLeadSchema = z.object({
  externalId: z.string().optional(),
  source: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  message: z.string().optional(),
  metadata: z.record(z.any()),
  rawData: z.any().optional()
});

export type IngestLeadInput = z.infer<typeof IngestLeadSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.string()
});

export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusSchema>;
