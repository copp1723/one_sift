import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from '../config/database.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runSqlFile(filePath: string) {
  try {
    const sqlContent = readFileSync(filePath, 'utf-8');
    console.log(`🔄 Running SQL file: ${filePath}`);
    await client.unsafe(sqlContent);
    console.log(`✅ Completed: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to run ${filePath}:`, error);
    throw error;
  }
}

async function initializeDatabase() {
  console.log('🚀 Initializing OneSift database...');

  try {
    // Run initialization scripts in order
    await runSqlFile(join(__dirname, 'init.sql'));
    await runSqlFile(join(__dirname, 'functions.sql'));
    await runSqlFile(join(__dirname, 'customer-schema.sql'));
    await runSqlFile(join(__dirname, 'analytics.sql'));

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function runMigrations() {
  console.log('🔄 Running Drizzle migrations...');

  try {
    await migrate(db, {
      migrationsFolder: './migrations',
      migrationsTable: 'drizzle_migrations'
    });

    console.log('✅ Drizzle migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'init':
        await initializeDatabase();
        break;
      case 'migrate':
        await runMigrations();
        break;
      case 'full':
      default:
        await initializeDatabase();
        await runMigrations();
        break;
    }

    console.log('🎉 Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runMigrations, initializeDatabase, main };
