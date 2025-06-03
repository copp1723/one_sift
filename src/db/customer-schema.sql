-- Complete Customer Schema Creation Function
-- This file contains the full customer schema setup with all tables and indexes

-- Drop and recreate the complete customer schema function
DROP FUNCTION IF EXISTS system.create_customer_schema(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION system.create_customer_schema(
    p_customer_id UUID,
    p_slug VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_schema_name VARCHAR;
BEGIN
    -- Generate schema name from slug
    v_schema_name := 'customer_' || replace(p_slug, '-', '_');
    
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);
    
    -- Create personas table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.personas (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            system_prompt TEXT NOT NULL,
            prompt_variables JSONB NOT NULL DEFAULT ''{}'',
            response_schema JSONB NOT NULL DEFAULT ''{}'',
            config JSONB NOT NULL DEFAULT ''{}'',
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name);
    
    -- Create leads table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.leads (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            external_id VARCHAR(255),
            status system.lead_status NOT NULL DEFAULT ''new'',
            source VARCHAR(255) NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            customer_email VARCHAR(255),
            customer_phone VARCHAR(50),
            metadata JSONB NOT NULL DEFAULT ''{}'',
            raw_data JSONB NOT NULL DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_external_id UNIQUE (external_id)
        )', v_schema_name);
    
    -- Create conversations table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            lead_id UUID NOT NULL REFERENCES %I.leads(id) ON DELETE CASCADE,
            persona_id UUID NOT NULL REFERENCES %I.personas(id),
            message_count INTEGER NOT NULL DEFAULT 0,
            sentiment VARCHAR(20),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_schema_name, v_schema_name);
    
    -- Create messages table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL REFERENCES %I.conversations(id) ON DELETE CASCADE,
            sender system.message_sender NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB NOT NULL DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_schema_name);
    
    -- Create handoffs table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.handoffs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            lead_id UUID NOT NULL REFERENCES %I.leads(id) ON DELETE CASCADE,
            conversation_id UUID NOT NULL REFERENCES %I.conversations(id) ON DELETE CASCADE,
            reason system.handoff_reason NOT NULL,
            dossier JSONB NOT NULL,
            sent_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', v_schema_name, v_schema_name, v_schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_leads_status ON %I.leads(status)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_leads_created ON %I.leads(created_at)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_leads_email ON %I.leads(customer_email)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_leads_phone ON %I.leads(customer_phone)', v_schema_name, v_schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_conversations_lead ON %I.conversations(lead_id)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_conversations_active ON %I.conversations(is_active) WHERE is_active = true', v_schema_name, v_schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_messages_conversation ON %I.messages(conversation_id)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_messages_created ON %I.messages(created_at)', v_schema_name, v_schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_handoffs_lead ON %I.handoffs(lead_id)', v_schema_name, v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_handoffs_created ON %I.handoffs(created_at)', v_schema_name, v_schema_name);

    -- Create default persona
    EXECUTE format('
        INSERT INTO %I.personas (name, system_prompt, is_default)
        VALUES (
            ''Default Assistant'',
            ''You are a helpful assistant at {{company_name}}. Your job is to understand customer needs and guide them effectively. Always be professional, friendly, and helpful.

Use this JSON structure for every reply:
{
  "answer": "<your response>",
  "follow_up": "<relevant question>",
  "escalate": false
}'',
            true
        ) ON CONFLICT DO NOTHING', v_schema_name);

    -- Update customer record with schema name
    UPDATE system.customers
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{schema_name}',
        to_jsonb(v_schema_name)
    )
    WHERE id = p_customer_id;

END;
$$ LANGUAGE plpgsql;
