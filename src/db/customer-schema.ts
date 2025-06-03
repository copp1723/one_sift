import { sql } from 'drizzle-orm';
import { db, withTransaction } from './index.js';
import { schemaNameFromSlug, sanitizeSlug } from '../utils/slug.js';

export interface CustomerSchemaOptions {
  customerId: string;
  slug: string;
}

export interface ApiKeyOptions {
  customerId: string;
  name: string;
  expiresAt?: Date;
}

export interface ApiKeyResult {
  id: string;
  key: string;
  keyHash: string;
}

/**
 * Create a new customer schema with all required tables
 */
export async function createCustomerSchema(options: CustomerSchemaOptions): Promise<void> {
  const slug = sanitizeSlug(options.slug);
  const schemaName = schemaNameFromSlug(slug);
  try {
    await withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT system.create_customer_schema(${options.customerId}::UUID, ${slug})`
      );

      await tx.execute(
        sql`SELECT system.create_customer_analytics_views(${schemaName})`
      );
    });

    console.log(`✅ Created customer schema: ${schemaName}`);
  } catch (error) {
    console.error(`❌ Failed to create customer schema for ${slug}:`, error);
    throw error;
  }
}

/**
 * Generate and store a new API key for a customer
 */
export async function createApiKey(options: ApiKeyOptions): Promise<ApiKeyResult> {
  try {
    // Generate the API key
    const [keyResult] = await db.execute(
      sql`SELECT system.generate_api_key() as key`
    );
    
    const apiKey = keyResult.key as string;
    const keyHash = await hashApiKey(apiKey);
    
    // Store the hashed key
    const [result] = await db.execute(sql`
      INSERT INTO system.api_keys (customer_id, key_hash, name, expires_at)
      VALUES (
        ${options.customerId}::UUID,
        ${keyHash},
        ${options.name},
        ${options.expiresAt || null}
      )
      RETURNING id
    `);
    
    return {
      id: result.id as string,
      key: apiKey,
      keyHash
    };
  } catch (error) {
    console.error('❌ Failed to create API key:', error);
    throw error;
  }
}

/**
 * Validate an API key and return customer information
 */
export async function validateApiKey(apiKey: string): Promise<{ customerId: string; isValid: boolean } | null> {
  try {
    const [result] = await db.execute(
      sql`SELECT * FROM system.validate_api_key(${apiKey})`
    );
    
    if (!result) {
      return null;
    }
    
    return {
      customerId: result.customer_id as string,
      isValid: result.is_valid as boolean
    };
  } catch (error) {
    console.error('❌ Failed to validate API key:', error);
    throw error;
  }
}

/**
 * Get customer schema name by customer ID
 */
export async function getCustomerSchema(customerId: string): Promise<string | null> {
  try {
    const [result] = await db.execute(
      sql`SELECT system.get_customer_schema(${customerId}::UUID) as schema_name`
    );
    
    return result?.schema_name as string || null;
  } catch (error) {
    console.error('❌ Failed to get customer schema:', error);
    throw error;
  }
}

/**
 * Clean up old data for a customer
 */
export async function cleanupCustomerData(customerId: string, daysToKeep: number = 90): Promise<number> {
  try {
    const schemaName = await getCustomerSchema(customerId);
    if (!schemaName) {
      throw new Error('Customer schema not found');
    }
    
    const [result] = await db.execute(
      sql`SELECT system.cleanup_old_data(${schemaName}, ${daysToKeep}) as deleted_count`
    );
    
    return result.deleted_count as number;
  } catch (error) {
    console.error('❌ Failed to cleanup customer data:', error);
    throw error;
  }
}

/**
 * Get storage size information for a customer
 */
export async function getCustomerStorageSize(customerId: string): Promise<Array<{
  tableName: string;
  sizePretty: string;
  sizeBytes: number;
}>> {
  try {
    const schemaName = await getCustomerSchema(customerId);
    if (!schemaName) {
      throw new Error('Customer schema not found');
    }
    
    const results = await db.execute(
      sql`SELECT * FROM system.get_customer_storage_size(${schemaName})`
    );
    
    return results.map(row => ({
      tableName: row.table_name as string,
      sizePretty: row.size_pretty as string,
      sizeBytes: row.size_bytes as number
    }));
  } catch (error) {
    console.error('❌ Failed to get customer storage size:', error);
    throw error;
  }
}

/**
 * Backup customer data
 */
export async function backupCustomerData(customerId: string): Promise<string> {
  try {
    const [result] = await db.execute(
      sql`SELECT system.backup_customer_data(${customerId}::UUID) as backup_data`
    );
    
    return result.backup_data as string;
  } catch (error) {
    console.error('❌ Failed to backup customer data:', error);
    throw error;
  }
}

/**
 * Hash an API key using the database function
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const [result] = await db.execute(
    sql`SELECT system.hash_api_key(${apiKey}) as hash`
  );
  
  return result.hash as string;
}
