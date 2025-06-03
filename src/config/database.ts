import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './index.js';
import * as schema from '../db/schema.js';

// Create the connection
const connectionString = config.DATABASE_URL;

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, {
  schema,
  logger: config.NODE_ENV === 'development'
});

// Export the client for migrations and direct queries if needed
export { client };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
}
