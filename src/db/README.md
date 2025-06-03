# OneSift Database Setup

This directory contains the complete PostgreSQL database setup for OneSift's multi-tenant architecture.

## Overview

OneSift uses a multi-tenant database architecture where:
- **System schema** contains shared tables (customers, API keys, audit logs)
- **Customer schemas** contain isolated data for each customer (leads, conversations, messages, etc.)
- **PostgreSQL functions** handle schema creation, validation, and maintenance

## Files Structure

```
src/db/
├── README.md              # This file
├── index.ts              # Database connection and exports
├── migrate.ts            # Migration runner with init capabilities
├── schema.ts             # Drizzle schema definitions
├── init.sql              # Core database initialization
├── functions.sql         # Basic PostgreSQL functions
├── customer-schema.sql   # Customer schema creation function
├── analytics.sql         # Analytics and maintenance functions
├── customer-schema.ts    # TypeScript utilities for customer management
└── seed.ts              # Database seeding utilities
```

## Quick Start

### 1. Initialize Database
```bash
# Full setup (recommended for first time)
npm run db:setup

# Or step by step:
npm run db:init     # Initialize core structure
npm run db:migrate  # Run Drizzle migrations
```

### 2. Seed Development Data
```bash
npm run db:seed
```

This creates example customers:
- **ABC Honda** (email mode) - `sarah-abc-honda@onesift.com`
- **Demo Dealership** (API mode) - with API key

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:init` | Initialize core database structure |
| `npm run db:migrate` | Run Drizzle migrations only |
| `npm run db:setup` | Full setup (init + migrate) |
| `npm run db:seed` | Seed development data |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema changes directly |

## Customer Management

### Creating a New Customer

```typescript
import { createCustomer } from './src/db/seed.js';

const result = await createCustomer({
  slug: 'new-dealership',
  name: 'New Dealership',
  ingestionMode: 'api',
  handoverEmail: 'sales@newdealership.com',
  handoverThreshold: 3
});

console.log('Customer ID:', result.customerId);
if (result.apiKey) {
  console.log('API Key:', result.apiKey);
}
```

### Working with Customer Schemas

```typescript
import { 
  createCustomerSchema, 
  validateApiKey, 
  getCustomerSchema 
} from './src/db/customer-schema.js';

// Create schema for existing customer
await createCustomerSchema({
  customerId: 'uuid-here',
  slug: 'customer-slug'
});

// Validate API key
const validation = await validateApiKey('osk_...');
if (validation?.isValid) {
  console.log('Valid customer:', validation.customerId);
}

// Get schema name
const schemaName = await getCustomerSchema('customer-id');
```

## Database Schema

### System Tables

- `system.customers` - Customer records
- `system.api_keys` - API keys for customers
- `system.audit_log` - System-wide audit trail

### Customer Tables (per schema)

- `personas` - AI personas for the customer
- `leads` - Lead records
- `conversations` - Conversation threads
- `messages` - Individual messages
- `handoffs` - Handoff records to human agents

### Enums

- `system.ingestion_mode` - 'email' | 'api'
- `system.lead_status` - 'new' | 'processing' | 'responded' | 'qualified' | 'handed_off' | 'error'
- `system.handoff_reason` - Various handoff triggers
- `system.message_sender` - 'customer' | 'ai' | 'system'

## Key Functions

### Customer Management
- `system.create_customer_schema(customer_id, slug)` - Create customer schema
- `system.get_customer_schema(customer_id)` - Get schema name

### API Key Management
- `system.generate_api_key()` - Generate new API key
- `system.hash_api_key(key)` - Hash API key
- `system.validate_api_key(key)` - Validate and update last used

### Analytics & Maintenance
- `system.create_customer_analytics_views(schema_name)` - Create analytics views
- `system.cleanup_old_data(schema_name, days)` - Clean old data
- `system.get_customer_storage_size(schema_name)` - Get storage info
- `system.backup_customer_data(customer_id)` - Backup customer data

## Environment Variables

Make sure these are set in your `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/onesift
```

## Security Features

- **Row Level Security** ready (can be enabled per table)
- **API key hashing** using SHA-256
- **Schema isolation** between customers
- **Audit logging** for all operations
- **Input validation** through constraints and checks

## Maintenance

### Cleanup Old Data
```typescript
import { cleanupCustomerData } from './src/db/customer-schema.js';

// Clean data older than 90 days
const deletedCount = await cleanupCustomerData('customer-id', 90);
```

### Storage Monitoring
```typescript
import { getCustomerStorageSize } from './src/db/customer-schema.js';

const sizes = await getCustomerStorageSize('customer-id');
sizes.forEach(table => {
  console.log(`${table.tableName}: ${table.sizePretty}`);
});
```

### Backup
```typescript
import { backupCustomerData } from './src/db/customer-schema.js';

const backup = await backupCustomerData('customer-id');
// backup contains JSON string with all customer data
```

## Troubleshooting

### Common Issues

1. **Permission errors**: Ensure database user has CREATE privileges
2. **Extension errors**: Make sure `uuid-ossp` and `pgcrypto` extensions are available
3. **Schema conflicts**: Customer slugs must be unique and follow naming rules

### Reset Database
```bash
# Drop and recreate (development only!)
psql -c "DROP DATABASE IF EXISTS onesift;"
psql -c "CREATE DATABASE onesift;"
npm run db:setup
npm run db:seed
```
