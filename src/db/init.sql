-- OneSift PostgreSQL Database Initialization
-- This file sets up the core database structure for OneSift

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create system schema for shared tables
CREATE SCHEMA IF NOT EXISTS system;

-- Create enums for system-wide use
DO $$ BEGIN
    CREATE TYPE system.ingestion_mode AS ENUM ('email', 'api');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE system.lead_status AS ENUM ('new', 'processing', 'responded', 'qualified', 'handed_off', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE system.handoff_reason AS ENUM ('message_limit', 'keyword_trigger', 'negative_sentiment', 'customer_request', 'ai_escalation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE system.message_sender AS ENUM ('customer', 'ai', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Customers table (system-wide)
CREATE TABLE IF NOT EXISTS system.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
    name VARCHAR(255) NOT NULL,
    ingestion_mode system.ingestion_mode NOT NULL,
    email_address VARCHAR(255) UNIQUE,
    handover_email VARCHAR(255) NOT NULL,
    handover_threshold INTEGER NOT NULL DEFAULT 3 CHECK (handover_threshold BETWEEN 1 AND 10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_slug ON system.customers(slug);
CREATE INDEX IF NOT EXISTS idx_customers_email ON system.customers(email_address);
CREATE INDEX IF NOT EXISTS idx_customers_active ON system.customers(is_active) WHERE is_active = true;

-- API Keys table for customers using API mode
CREATE TABLE IF NOT EXISTS system.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES system.customers(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON system.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON system.api_keys(customer_id);

-- System audit log
CREATE TABLE IF NOT EXISTS system.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES system.customers(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_customer ON system.audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON system.audit_log(created_at);

-- System-wide analytics view
CREATE OR REPLACE VIEW system.customer_analytics AS
SELECT 
    c.id,
    c.name,
    c.slug,
    c.ingestion_mode,
    c.created_at,
    COUNT(DISTINCT al.id) as total_activities,
    MAX(al.created_at) as last_activity
FROM system.customers c
LEFT JOIN system.audit_log al ON al.customer_id = c.id
GROUP BY c.id;
