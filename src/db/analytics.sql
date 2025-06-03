-- OneSift Analytics and Maintenance Functions
-- This file contains analytics views and maintenance functions

-- Function to create customer-specific analytics views
CREATE OR REPLACE FUNCTION system.create_customer_analytics_views(
    p_schema_name VARCHAR
) RETURNS VOID AS $$
BEGIN
    -- Lead analytics view
    EXECUTE format('
        CREATE OR REPLACE VIEW %I.lead_analytics AS
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_leads,
            COUNT(CASE WHEN status = ''qualified'' THEN 1 END) as qualified_leads,
            COUNT(CASE WHEN status = ''handed_off'' THEN 1 END) as handed_off_leads,
            COUNT(DISTINCT customer_email) as unique_emails,
            COUNT(DISTINCT customer_phone) as unique_phones
        FROM %I.leads
        GROUP BY DATE(created_at)
    ', p_schema_name, p_schema_name);
    
    -- Conversation analytics view
    EXECUTE format('
        CREATE OR REPLACE VIEW %I.conversation_analytics AS
        SELECT 
            c.id,
            c.lead_id,
            c.message_count,
            c.sentiment,
            l.customer_name,
            l.status as lead_status,
            c.created_at,
            c.updated_at,
            CASE 
                WHEN h.id IS NOT NULL THEN true 
                ELSE false 
            END as was_handed_off
        FROM %I.conversations c
        JOIN %I.leads l ON l.id = c.lead_id
        LEFT JOIN %I.handoffs h ON h.conversation_id = c.id
    ', p_schema_name, p_schema_name, p_schema_name, p_schema_name);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION system.cleanup_old_data(
    p_schema_name VARCHAR,
    p_days_to_keep INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete old messages first (cascade will handle)
    EXECUTE format('
        DELETE FROM %I.messages 
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL ''%s days''
    ', p_schema_name, p_days_to_keep);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO system.audit_log (action, entity_type, changes)
    VALUES (
        'cleanup_old_data',
        'messages',
        jsonb_build_object(
            'schema', p_schema_name,
            'deleted_count', v_deleted_count,
            'days_kept', p_days_to_keep
        )
    );
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get storage size per customer
CREATE OR REPLACE FUNCTION system.get_customer_storage_size(p_schema_name VARCHAR)
RETURNS TABLE (
    table_name VARCHAR,
    size_pretty TEXT,
    size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tablename::VARCHAR,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))::TEXT,
        pg_total_relation_size(schemaname||'.'||tablename)::BIGINT
    FROM pg_tables
    WHERE schemaname = p_schema_name
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to backup customer data
CREATE OR REPLACE FUNCTION system.backup_customer_data(
    p_customer_id UUID,
    p_format VARCHAR DEFAULT 'json'
) RETURNS TEXT AS $$
DECLARE
    v_schema_name VARCHAR;
    v_backup JSONB;
BEGIN
    -- Get schema name
    v_schema_name := system.get_customer_schema(p_customer_id);
    
    -- Build backup JSON
    EXECUTE format('
        SELECT jsonb_build_object(
            ''customer_id'', %L,
            ''backup_date'', CURRENT_TIMESTAMP,
            ''leads'', (SELECT jsonb_agg(row_to_json(l)) FROM %I.leads l),
            ''conversations'', (SELECT jsonb_agg(row_to_json(c)) FROM %I.conversations c),
            ''messages'', (SELECT jsonb_agg(row_to_json(m)) FROM %I.messages m),
            ''handoffs'', (SELECT jsonb_agg(row_to_json(h)) FROM %I.handoffs h),
            ''personas'', (SELECT jsonb_agg(row_to_json(p)) FROM %I.personas p)
        )
    ', p_customer_id, v_schema_name, v_schema_name, v_schema_name, v_schema_name, v_schema_name)
    INTO v_backup;
    
    RETURN v_backup::TEXT;
END;
$$ LANGUAGE plpgsql;
