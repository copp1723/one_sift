import { z } from 'zod';
import { IngestionMode, LeadStatus, HandoffReason } from './database.js';

// API Request types
export interface CreateCustomerRequest {
  name: string;
  slug: string;
  ingestionMode: IngestionMode;
  handoverEmail: string;
  handoverThreshold?: number;
  metadata?: Record<string, any>;
}

export interface CreatePersonaRequest {
  name: string;
  systemPrompt: string;
  promptVariables?: Record<string, any>;
  responseSchema?: Record<string, any>;
  config?: {
    temperature?: number;
    maxResponseLength?: number;
    escalationKeywords?: string[];
  };
  isDefault?: boolean;
}

export interface IngestLeadRequest {
  externalId?: string;
  source: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  message?: string;
  metadata?: Record<string, any>;
  rawData?: any;
}

// Validation schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  ingestionMode: z.enum(['email', 'api']),
  handoverEmail: z.string().email(),
  handoverThreshold: z.number().min(1).default(3),
  metadata: z.record(z.any()).optional().default({})
});

export const createPersonaSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  promptVariables: z.record(z.any()).optional().default({}),
  responseSchema: z.record(z.any()).optional().default({}),
  config: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxResponseLength: z.number().min(1).optional(),
    escalationKeywords: z.array(z.string()).optional()
  }).optional().default({}),
  isDefault: z.boolean().optional().default(false)
});

export const ingestLeadSchema = z.object({
  externalId: z.string().optional(),
  source: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
  rawData: z.any().optional()
});

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Webhook types
export interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: 'delivered' | 'opened' | 'clicked' | 'unsubscribed' | 'complained' | 'bounced';
    timestamp: number;
    id: string;
    recipient: string;
    message: {
      headers: {
        'message-id': string;
        from: string;
        to: string;
        subject: string;
      };
    };
  };
}
