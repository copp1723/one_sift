/**
 * OneSift Database Usage Examples
 * 
 * This file demonstrates how to use the OneSift database functions
 * for common operations like creating customers, managing API keys,
 * and working with customer data.
 */

import { 
  createCustomer, 
  getAllCustomers 
} from '../src/db/seed.js';

import { 
  createCustomerSchema,
  createApiKey,
  validateApiKey,
  getCustomerSchema,
  cleanupCustomerData,
  getCustomerStorageSize,
  backupCustomerData
} from '../src/db/customer-schema.js';

import { db } from '../src/config/database.js';
import { sql } from 'drizzle-orm';

async function exampleUsage() {
  console.log('🚀 OneSift Database Usage Examples\n');

  try {
    // 1. Create a new customer
    console.log('1. Creating a new customer...');
    const newCustomer = await createCustomer({
      slug: 'example-motors',
      name: 'Example Motors',
      ingestionMode: 'api',
      handoverEmail: 'sales@examplemotors.com',
      handoverThreshold: 5
    });
    
    console.log(`✅ Created customer: ${newCustomer.customerId}`);
    if (newCustomer.apiKey) {
      console.log(`🔑 API Key: ${newCustomer.apiKey}\n`);
    }

    // 2. Validate the API key
    if (newCustomer.apiKey) {
      console.log('2. Validating API key...');
      const validation = await validateApiKey(newCustomer.apiKey);
      console.log(`✅ API key valid: ${validation?.isValid}\n`);
    }

    // 3. Get customer schema name
    console.log('3. Getting customer schema...');
    const schemaName = await getCustomerSchema(newCustomer.customerId);
    console.log(`✅ Schema name: ${schemaName}\n`);

    // 4. Add some sample data to the customer schema
    console.log('4. Adding sample lead data...');
    await addSampleLeadData(newCustomer.customerId, schemaName!);
    console.log('✅ Sample data added\n');

    // 5. Get all customers
    console.log('5. Getting all customers...');
    const customers = await getAllCustomers();
    console.log(`✅ Found ${customers.length} customers:`);
    customers.forEach(customer => {
      console.log(`   - ${customer.name} (${customer.slug}) - ${customer.ingestionMode}`);
    });
    console.log();

    // 6. Get storage size information
    console.log('6. Getting storage size information...');
    const storageInfo = await getCustomerStorageSize(newCustomer.customerId);
    console.log('✅ Storage information:');
    storageInfo.forEach(table => {
      console.log(`   - ${table.tableName}: ${table.sizePretty}`);
    });
    console.log();

    // 7. Backup customer data
    console.log('7. Creating backup...');
    const backup = await backupCustomerData(newCustomer.customerId);
    const backupData = JSON.parse(backup);
    console.log(`✅ Backup created with ${Object.keys(backupData).length} sections\n`);

    // 8. Cleanup old data (this won't delete anything since data is new)
    console.log('8. Running cleanup (90 days)...');
    const deletedCount = await cleanupCustomerData(newCustomer.customerId, 90);
    console.log(`✅ Cleaned up ${deletedCount} old records\n`);

    console.log('🎉 All examples completed successfully!');

  } catch (error) {
    console.error('❌ Error in examples:', error);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

/**
 * Add sample lead data to demonstrate the customer schema
 */
async function addSampleLeadData(customerId: string, schemaName: string) {
  // Get the default persona
  const [persona] = await db.execute(sql`
    SELECT id FROM ${sql.identifier(schemaName, 'personas')} 
    WHERE is_default = true 
    LIMIT 1
  `);

  if (!persona) {
    throw new Error('No default persona found');
  }

  // Create a sample lead
  const [lead] = await db.execute(sql`
    INSERT INTO ${sql.identifier(schemaName, 'leads')} (
      external_id,
      source,
      customer_name,
      customer_email,
      customer_phone,
      metadata
    ) VALUES (
      'LEAD-001',
      'website',
      'John Doe',
      'john.doe@email.com',
      '+1-555-0123',
      '{"vehicle_interest": "Honda Civic", "budget": "25000"}'::jsonb
    )
    RETURNING id
  `);

  // Create a conversation
  const [conversation] = await db.execute(sql`
    INSERT INTO ${sql.identifier(schemaName, 'conversations')} (
      lead_id,
      persona_id,
      sentiment
    ) VALUES (
      ${lead.id}::UUID,
      ${persona.id}::UUID,
      'positive'
    )
    RETURNING id
  `);

  // Add some messages
  const messages = [
    { sender: 'customer', content: 'Hi, I\'m interested in a Honda Civic. What do you have available?' },
    { sender: 'ai', content: 'Hello John! Great choice! We have several Honda Civics available. What\'s your preferred color and budget range?' },
    { sender: 'customer', content: 'I\'m looking for something in blue, budget around $25,000.' }
  ];

  for (const message of messages) {
    await db.execute(sql`
      INSERT INTO ${sql.identifier(schemaName, 'messages')} (
        conversation_id,
        sender,
        content
      ) VALUES (
        ${conversation.id}::UUID,
        ${message.sender}::system.message_sender,
        ${message.content}
      )
    `);
  }

  // Update conversation message count
  await db.execute(sql`
    UPDATE ${sql.identifier(schemaName, 'conversations')}
    SET message_count = ${messages.length}
    WHERE id = ${conversation.id}::UUID
  `);
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };
