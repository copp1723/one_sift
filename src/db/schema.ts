import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const ingestionModeEnum = pgEnum('ingestion_mode', ['email', 'api']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'processing', 'responded', 'qualified', 'handed_off', 'error']);
export const handoffReasonEnum = pgEnum('handoff_reason', ['message_limit', 'keyword_trigger', 'negative_sentiment', 'customer_request', 'ai_escalation']);

// Customers table
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  ingestionMode: ingestionModeEnum('ingestion_mode').notNull(),
  emailAddress: text('email_address'),
  handoverEmail: text('handover_email').notNull(),
  handoverThreshold: integer('handover_threshold').notNull().default(3),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    slugIdx: index('customers_slug_idx').on(table.slug),
    emailIdx: index('customers_email_idx').on(table.emailAddress)
  };
});

// Personas table
export const personas = pgTable('personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  promptVariables: jsonb('prompt_variables').notNull().default({}),
  responseSchema: jsonb('response_schema').notNull().default({}),
  config: jsonb('config').notNull().default({}),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    customerIdx: index('personas_customer_idx').on(table.customerId),
    defaultIdx: index('personas_default_idx').on(table.customerId, table.isDefault)
  };
});

// Leads table
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  status: leadStatusEnum('status').notNull().default('new'),
  source: text('source').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  metadata: jsonb('metadata').notNull().default({}),
  rawData: jsonb('raw_data').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    customerIdx: index('leads_customer_idx').on(table.customerId),
    statusIdx: index('leads_status_idx').on(table.status),
    externalIdx: unique('leads_external_unique').on(table.customerId, table.externalId)
  };
});

// Conversations table
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  personaId: uuid('persona_id').notNull().references(() => personas.id),
  messageCount: integer('message_count').notNull().default(0),
  sentiment: text('sentiment'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    leadIdx: index('conversations_lead_idx').on(table.leadId),
    customerIdx: index('conversations_customer_idx').on(table.customerId),
    activeIdx: index('conversations_active_idx').on(table.isActive)
  };
});

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  sender: text('sender').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => {
  return {
    conversationIdx: index('messages_conversation_idx').on(table.conversationId),
    createdIdx: index('messages_created_idx').on(table.createdAt)
  };
});

// Handoffs table
export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  reason: handoffReasonEnum('reason').notNull(),
  dossier: jsonb('dossier').notNull(),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => {
  return {
    leadIdx: index('handoffs_lead_idx').on(table.leadId),
    customerIdx: index('handoffs_customer_idx').on(table.customerId)
  };
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  personas: many(personas),
  leads: many(leads),
  conversations: many(conversations),
  handoffs: many(handoffs)
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  customer: one(customers, {
    fields: [personas.customerId],
    references: [customers.id]
  }),
  conversations: many(conversations)
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  customer: one(customers, {
    fields: [leads.customerId],
    references: [customers.id]
  }),
  conversations: many(conversations),
  handoffs: many(handoffs)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id]
  }),
  customer: one(customers, {
    fields: [conversations.customerId],
    references: [customers.id]
  }),
  persona: one(personas, {
    fields: [conversations.personaId],
    references: [personas.id]
  }),
  messages: many(messages),
  handoffs: many(handoffs)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  })
}));

export const handoffsRelations = relations(handoffs, ({ one }) => ({
  lead: one(leads, {
    fields: [handoffs.leadId],
    references: [leads.id]
  }),
  conversation: one(conversations, {
    fields: [handoffs.conversationId],
    references: [conversations.id]
  }),
  customer: one(customers, {
    fields: [handoffs.customerId],
    references: [customers.id]
  })
}));

// Export TypeScript enums for use in API validation
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
