import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';
import { createCustomerSchema, createApiKey } from './customer-schema.js';

export interface SeedCustomerData {
  slug: string;
  name: string;
  ingestionMode: 'email' | 'api';
  emailAddress?: string;
  handoverEmail: string;
  handoverThreshold?: number;
}

/**
 * Seed the database with initial customer data
 */
export async function seedDatabase(): Promise<void> {
  console.log('🌱 Seeding OneSift database...');
  
  try {
    // Example customers for development
    const customers: SeedCustomerData[] = [
      {
        slug: 'abc-honda',
        name: 'ABC Honda',
        ingestionMode: 'email',
        emailAddress: 'sarah-abc-honda@onesift.com',
        handoverEmail: 'sales@abchonda.com',
        handoverThreshold: 3
      },
      {
        slug: 'demo-dealership',
        name: 'Demo Dealership',
        ingestionMode: 'api',
        handoverEmail: 'leads@demodealership.com',
        handoverThreshold: 5
      }
    ];
    
    for (const customerData of customers) {
      await createSeedCustomer(customerData);
    }
    
    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * Create a seed customer with schema and API key
 */
async function createSeedCustomer(data: SeedCustomerData): Promise<void> {
  try {
    // Check if customer already exists
    const [existing] = await db.execute(
      sql`SELECT id FROM system.customers WHERE slug = ${data.slug}`
    );
    
    if (existing) {
      console.log(`⏭️  Customer ${data.slug} already exists, skipping...`);
      return;
    }
    
    // Create customer record
    const [customer] = await db.execute(sql`
      INSERT INTO system.customers (
        slug, 
        name, 
        ingestion_mode, 
        email_address, 
        handover_email, 
        handover_threshold
      )
      VALUES (
        ${data.slug},
        ${data.name},
        ${data.ingestionMode}::system.ingestion_mode,
        ${data.emailAddress || null},
        ${data.handoverEmail},
        ${data.handoverThreshold || 3}
      )
      RETURNING id
    `);
    
    const customerId = customer.id as string;
    
    // Create customer schema
    await createCustomerSchema({
      customerId,
      slug: data.slug
    });
    
    // Create API key for API mode customers
    if (data.ingestionMode === 'api') {
      const apiKey = await createApiKey({
        customerId,
        name: 'Development API Key'
      });
      
      console.log(`🔑 API Key for ${data.name}: ${apiKey.key}`);
    }
    
    console.log(`✅ Created customer: ${data.name} (${data.slug})`);
  } catch (error) {
    console.error(`❌ Failed to create customer ${data.slug}:`, error);
    throw error;
  }
}

/**
 * Create a new customer (for use in application)
 */
export async function createCustomer(data: SeedCustomerData): Promise<{
  customerId: string;
  apiKey?: string;
}> {
  try {
    // Create customer record
    const [customer] = await db.execute(sql`
      INSERT INTO system.customers (
        slug, 
        name, 
        ingestion_mode, 
        email_address, 
        handover_email, 
        handover_threshold
      )
      VALUES (
        ${data.slug},
        ${data.name},
        ${data.ingestionMode}::system.ingestion_mode,
        ${data.emailAddress || null},
        ${data.handoverEmail},
        ${data.handoverThreshold || 3}
      )
      RETURNING id
    `);
    
    const customerId = customer.id as string;
    
    // Create customer schema
    await createCustomerSchema({
      customerId,
      slug: data.slug
    });
    
    // Create API key for API mode customers
    let apiKey: string | undefined;
    if (data.ingestionMode === 'api') {
      const keyResult = await createApiKey({
        customerId,
        name: 'Production API Key'
      });
      apiKey = keyResult.key;
    }
    
    // Log audit event
    await db.execute(sql`
      INSERT INTO system.audit_log (customer_id, action, entity_type, entity_id, changes)
      VALUES (
        ${customerId}::UUID,
        'customer_created',
        'customer',
        ${customerId}::UUID,
        ${JSON.stringify(data)}::jsonb
      )
    `);
    
    return { customerId, apiKey };
  } catch (error) {
    console.error('❌ Failed to create customer:', error);
    throw error;
  }
}

/**
 * Get all customers
 */
export async function getAllCustomers(): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  ingestionMode: string;
  emailAddress?: string;
  handoverEmail: string;
  isActive: boolean;
  createdAt: Date;
}>> {
  try {
    const results = await db.execute(sql`
      SELECT 
        id,
        slug,
        name,
        ingestion_mode,
        email_address,
        handover_email,
        is_active,
        created_at
      FROM system.customers
      ORDER BY created_at DESC
    `);
    
    return results.map(row => ({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      ingestionMode: row.ingestion_mode as string,
      emailAddress: row.email_address as string | undefined,
      handoverEmail: row.handover_email as string,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string)
    }));
  } catch (error) {
    console.error('❌ Failed to get customers:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(console.error);
}
