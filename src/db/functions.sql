-- OneSift PostgreSQL Functions
-- This file contains all the stored procedures and functions for OneSift

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION system.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to system tables
DROP TRIGGER IF EXISTS update_customers_updated_at ON system.customers;
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON system.customers 
    FOR EACH ROW 
    EXECUTE FUNCTION system.update_updated_at_column();

-- Function to get customer schema name
CREATE OR REPLACE FUNCTION system.get_customer_schema(p_customer_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_schema_name VARCHAR;
BEGIN
    SELECT metadata->>'schema_name' 
    INTO v_schema_name
    FROM system.customers
    WHERE id = p_customer_id;
    
    RETURN v_schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function to generate API key
CREATE OR REPLACE FUNCTION system.generate_api_key()
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'osk_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to hash API key
CREATE OR REPLACE FUNCTION system.hash_api_key(p_key VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN encode(digest(p_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to validate API key
CREATE OR REPLACE FUNCTION system.validate_api_key(p_key VARCHAR)
RETURNS TABLE (customer_id UUID, is_valid BOOLEAN) AS $$
DECLARE
    v_key_hash VARCHAR;
BEGIN
    v_key_hash := system.hash_api_key(p_key);

    RETURN QUERY
    SELECT
        ak.customer_id,
        CASE
            WHEN ak.is_active = true
                AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)
                AND c.is_active = true
            THEN true
            ELSE false
        END as is_valid
    FROM system.api_keys ak
    JOIN system.customers c ON c.id = ak.customer_id
    WHERE ak.key_hash = v_key_hash;

    -- Update last used timestamp
    UPDATE system.api_keys
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE key_hash = v_key_hash;
END;
$$ LANGUAGE plpgsql;

-- Function to create customer schema and tables
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
END;
$$ LANGUAGE plpgsql;
