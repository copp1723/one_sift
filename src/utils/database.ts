import { eq, and, SQL, sql } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { customers } from '../db/schema.js';

/**
 * Options for entity finder functions
 */
export interface FindOptions {
  /** Whether to throw an error if the entity is not found */
  throwIfNotFound?: boolean;
  /** Custom error message if the entity is not found */
  errorMessage?: string;
}

/**
 * Error thrown when an entity is not found
 */
export class EntityNotFoundError extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} with ID ${id} not found`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Find an entity by ID
 * 
 * @template T - Entity type
 * @param table - The database table
 * @param id - The entity ID
 * @param options - Find options
 * @returns The entity or null if not found
 * @throws EntityNotFoundError if throwIfNotFound is true and the entity is not found
 * @example
 * ```ts
 * // Find a customer by ID or return null if not found
 * const customer = await findById(customers, id);
 * 
 * // Find a customer by ID or throw an error if not found
 * const customer = await findById(customers, id, { throwIfNotFound: true });
 * ```
 */
export async function findById<T>(
  table: PgTable,
  id: string,
  options: FindOptions = {}
): Promise<T | null> {
  const [entity] = await db
    .select()
    .from(table)
    .where(eq(table.id as unknown as PgColumn, id))
    .limit(1);

  if (!entity && options.throwIfNotFound) {
    throw new EntityNotFoundError(
      table._.name, 
      id
    );
  }

  return entity as T || null;
}

/**
 * Find an entity by a specific field value
 * 
 * @template T - Entity type
 * @param table - The database table
 * @param field - The field to search by
 * @param value - The value to search for
 * @param options - Find options
 * @returns The entity or null if not found
 * @throws EntityNotFoundError if throwIfNotFound is true and the entity is not found
 * @example
 * ```ts
 * // Find a customer by slug
 * const customer = await findByField(customers, 'slug', slug);
 * ```
 */
export async function findByField<T>(
  table: PgTable,
  field: string,
  value: any,
  options: FindOptions = {}
): Promise<T | null> {
  const [entity] = await db
    .select()
    .from(table)
    .where(eq(table[field as keyof typeof table] as unknown as PgColumn, value))
    .limit(1);

  if (!entity && options.throwIfNotFound) {
    throw new EntityNotFoundError(
      table._.name, 
      `${field}:${value}`
    );
  }

  return entity as T || null;
}

/**
 * Check if an entity exists by ID
 * 
 * @param table - The database table
 * @param id - The entity ID
 * @returns True if the entity exists, false otherwise
 * @example
 * ```ts
 * if (await exists(customers, id)) {
 *   // Customer exists
 * }
 * ```
 */
export async function exists(
  table: PgTable,
  id: string
): Promise<boolean> {
  const query = sql<boolean>`EXISTS(SELECT 1 FROM ${table} WHERE id = ${id})`;
  const [result] = await db
    .select({ exists: query })
    .from(sql`(SELECT 1) as dummy`);
  
  return result?.exists || false;
}

/**
 * Check if an entity does not exist by a unique field value
 * 
 * @param table - The database table
 * @param field - The field to check
 * @param value - The value to check
 * @returns True if the entity does not exist, false if it exists
 * @example
 * ```ts
 * if (await notExists(customers, 'slug', slug)) {
 *   // Slug is available
 * }
 * ```
 */
export async function notExists(
  table: PgTable,
  field: string,
  value: any
): Promise<boolean> {
  const query = sql<boolean>`EXISTS(SELECT 1 FROM ${table} WHERE ${sql.identifier(field)} = ${value})`;
  const [result] = await db
    .select({ exists: query })
    .from(sql`(SELECT 1) as dummy`);
  
  return !result?.exists;
}

/**
 * Verify that a customer exists and return it
 * 
 * @param customerId - The customer ID
 * @param options - Find options
 * @returns The customer or null if not found
 * @throws EntityNotFoundError if throwIfNotFound is true and the customer is not found
 * @example
 * ```ts
 * const customer = await verifyCustomer(customerId, { throwIfNotFound: true });
 * ```
 */
export async function verifyCustomer(
  customerId: string,
  options: FindOptions = {}
): Promise<typeof customers.$inferSelect | null> {
  return findById<typeof customers.$inferSelect>(customers, customerId, options);
}

/**
 * Verify that a customer exists, is active, and return it
 * 
 * @param customerId - The customer ID
 * @returns The customer if it exists and is active
 * @throws EntityNotFoundError if the customer is not found
 * @throws Error if the customer is inactive
 * @example
 * ```ts
 * try {
 *   const customer = await verifyActiveCustomer(customerId);
 *   // Customer exists and is active
 * } catch (error) {
 *   // Handle not found or inactive customer
 * }
 * ```
 */
export async function verifyActiveCustomer(
  customerId: string
): Promise<typeof customers.$inferSelect> {
  const customer = await findById<typeof customers.$inferSelect>(
    customers, 
    customerId, 
    { throwIfNotFound: true }
  );
  
  // At this point, customer cannot be null because throwIfNotFound is true
  if (!customer!.isActive) {
    throw new Error('Customer account is inactive');
  }
  
  return customer!;
}

/**
 * Build a query with pagination
 * 
 * @param baseQuery - The base query to add pagination to
 * @param page - The page number (1-based)
 * @param limit - The number of items per page
 * @returns The query with pagination added
 * @example
 * ```ts
 * const query = db.select().from(leads).where(eq(leads.customerId, customerId));
 * const paginatedQuery = buildPaginationQuery(query, page, limit);
 * const results = await paginatedQuery;
 * ```
 */
export function buildPaginationQuery(
  baseQuery: any,
  page: number = 1,
  limit: number = 20
): any {
  return baseQuery
    .limit(limit)
    .offset((page - 1) * limit);
}

/**
 * Count total records matching a query
 * 
 * @param table - The database table
 * @param conditions - Optional array of SQL conditions
 * @returns The total count of matching records
 * @example
 * ```ts
 * const conditions = [eq(leads.customerId, customerId)];
 * if (status) {
 *   conditions.push(eq(leads.status, status));
 * }
 * const total = await countRecords(leads, conditions);
 * ```
 */
export async function countRecords(
  table: PgTable,
  conditions: SQL[] = []
): Promise<number> {
  let query = db.select({ count: sql<number>`count(*)` }).from(table);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  const [result] = await query;
  return Number(result?.count || 0);
}

/**
 * Build a filtered query with multiple conditions
 * 
 * @param table - The database table
 * @param conditions - Array of SQL conditions
 * @returns The query with conditions applied
 * @example
 * ```ts
 * const conditions = [eq(leads.customerId, customerId)];
 * if (status) {
 *   conditions.push(eq(leads.status, status));
 * }
 * const query = buildFilteredQuery(leads, conditions);
 * const results = await query;
 * ```
 */
export function buildFilteredQuery(
  table: PgTable,
  conditions: SQL[] = []
): any {
  const query = db.select().from(table);
  
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  
  return query;
}

/**
 * Execute a transaction with automatic rollback on error
 * 
 * @param callback - The transaction callback
 * @returns The result of the transaction
 * @example
 * ```ts
 * const result = await transaction(async (tx) => {
 *   const [customer] = await tx.insert(customers).values(customerData).returning();
 *   await tx.insert(leads).values({ ...leadData, customerId: customer.id });
 *   return customer;
 * });
 * ```
 */
export async function transaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}
