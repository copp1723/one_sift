// Base types
export type UUID = string;
export type ISODateTime = string;

// Enums
export enum IngestionMode {
  EMAIL = 'email',
  API = 'api'
}

export enum LeadStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  RESPONDED = 'responded',
  QUALIFIED = 'qualified',
  HANDED_OFF = 'handed_off',
  ERROR = 'error'
}

export enum HandoffReason {
  MESSAGE_LIMIT = 'message_limit',
  KEYWORD_TRIGGER = 'keyword_trigger',
  NEGATIVE_SENTIMENT = 'negative_sentiment',
  CUSTOMER_REQUEST = 'customer_request',
  AI_ESCALATION = 'ai_escalation'
}

// Customer types
export interface Customer {
  id: UUID;
  slug: string;
  name: string;
  ingestionMode: IngestionMode;
  emailAddress?: string;  // For email mode: sarah-abc-honda@onesift.com
  handoverEmail: string;  // Where to send qualified leads
  handoverThreshold: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isActive: boolean;
  metadata: Record<string, any>;
}

// Persona types
export interface Persona {
  id: UUID;
  customerId: UUID;
  name: string;
  systemPrompt: string;
  promptVariables: Record<string, any>;
  responseSchema: Record<string, any>;
  config: {
    temperature?: number;
    maxResponseLength?: number;
    escalationKeywords?: string[];
  };
  isDefault: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Lead types
export interface Lead {
  id: UUID;
  customerId: UUID;
  externalId?: string;
  status: LeadStatus;
  source: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata: Record<string, any>;
  rawData: any;  // Original ADF/JSON
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Conversation types
export interface Conversation {
  id: UUID;
  leadId: UUID;
  customerId: UUID;
  personaId: UUID;
  messages: Message[];
  messageCount: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Message {
  id: UUID;
  conversationId: UUID;
  sender: 'customer' | 'ai' | 'system';
  content: string;
  metadata?: Record<string, any>;
  createdAt: ISODateTime;
}

// Handoff types
export interface Handoff {
  id: UUID;
  leadId: UUID;
  conversationId: UUID;
  customerId: UUID;
  reason: HandoffReason;
  dossier: HandoffDossier;
  sentAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface HandoffDossier {
  lead: Lead;
  conversation: {
    messages: Message[];
    summary: string;
    sentiment: string;
    keyPoints: string[];
  };
  recommendations: string[];
  metadata: Record<string, any>;
}