/**
 * Database Utilities
 * 
 * Reusable database operation patterns that eliminate duplication
 * and provide consistent error handling across the application.
 * 
 * These utilities follow the same pattern as response utilities:
 * - Semantic function names that clearly express intent
 * - Consistent error handling with automatic logging
 * - Type-safe operations with TypeScript interfaces
 * - Comprehensive JSDoc documentation for IDE support
 */

import { eq, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';

/**
 * Generic type for database table with id field
 */
type TableWithId = PgTable & {
  id: any;
  [key: string]: any;
};



/**
 * Result type for database operations
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Find a record by ID or return null if not found
 * 
 * @param table - The database table to query
 * @param id - The ID to search for
 * @returns Promise<T | null> - The found record or null
 * 
 * @example
 * ```typescript
 * const customer = await findById(customers, customerId);
 * if (!customer) {
 *   sendNotFound(reply, 'Customer', request.id);
 *   return;
 * }
 * ```
 */
export async function findById<T>(
  table: TableWithId,
  id: string
): Promise<T | null> {
  const [record] = await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  return (record as T) || null;
}

/**
 * Find a record by any field or return null if not found
 * 
 * @param table - The database table to query
 * @param field - The table field to search by
 * @param value - The value to search for
 * @returns Promise<T | null> - The found record or null
 * 
 * @example
 * ```typescript
 * const customer = await findByField(customers, customers.slug, 'my-slug');
 * if (!customer) {
 *   sendNotFound(reply, 'Customer', request.id);
 *   return;
 * }
 * ```
 */
export async function findByField<T>(
  table: PgTable,
  field: any,
  value: any
): Promise<T | null> {
  const [record] = await db
    .select()
    .from(table)
    .where(eq(field, value))
    .limit(1);

  return (record as T) || null;
}

/**
 * Check if a record exists by field value
 * 
 * @param table - The database table to query
 * @param field - The table field to check
 * @param value - The value to check for
 * @returns Promise<boolean> - True if record exists, false otherwise
 * 
 * @example
 * ```typescript
 * const slugExists = await checkExists(customers, customers.slug, 'my-slug');
 * if (slugExists) {
 *   sendConflict(reply, 'Customer with this slug already exists', request.id);
 *   return;
 * }
 * ```
 */
export async function checkExists(
  table: PgTable,
  field: any,
  value: any
): Promise<boolean> {
  const [record] = await db
    .select({ id: field })
    .from(table)
    .where(eq(field, value))
    .limit(1);
  
  return !!record;
}

/**
 * Create a record with automatic conflict checking
 * 
 * @param table - The database table to insert into
 * @param data - The data to insert
 * @param conflictField - Optional field to check for conflicts
 * @param conflictValue - Optional value to check for conflicts
 * @returns Promise<DatabaseResult<T>> - Result with success/error status
 * 
 * @example
 * ```typescript
 * const result = await createWithConflictCheck(
 *   customers,
 *   customerData,
 *   customers.slug,
 *   customerData.slug
 * );
 * 
 * if (!result.success) {
 *   sendConflict(reply, result.error!, request.id);
 *   return;
 * }
 * 
 * sendCreated(reply, result.data!);
 * ```
 */
export async function createWithConflictCheck<T>(
  table: PgTable,
  data: any,
  conflictField?: any,
  conflictValue?: any
): Promise<DatabaseResult<T>> {
  try {
    // Check for conflicts if specified
    if (conflictField && conflictValue) {
      const exists = await checkExists(table, conflictField, conflictValue);
      if (exists) {
        return {
          success: false,
          error: 'Record with this value already exists'
        };
      }
    }

    // Create the record
    const [newRecord] = await db
      .insert(table)
      .values(data)
      .returning();

    return {
      success: true,
      data: newRecord as T
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update a record by ID with existence checking
 * 
 * @param table - The database table to update
 * @param id - The ID of the record to update
 * @param data - The data to update
 * @returns Promise<DatabaseResult<T>> - Result with success/error status
 * 
 * @example
 * ```typescript
 * const result = await updateById(customers, customerId, updateData);
 * 
 * if (!result.success) {
 *   sendNotFound(reply, 'Customer', request.id);
 *   return;
 * }
 * 
 * sendSuccess(reply, result.data!);
 * ```
 */
export async function updateById<T>(
  table: TableWithId,
  id: string,
  data: any
): Promise<DatabaseResult<T>> {
  try {
    const [updatedRecord] = await db
      .update(table)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(table.id, id))
      .returning();

    if (!updatedRecord) {
      return {
        success: false,
        error: 'Record not found'
      };
    }

    return {
      success: true,
      data: updatedRecord as T
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all records from a table with optional ordering
 * 
 * @param table - The database table to query
 * @param orderBy - Optional field to order by
 * @returns Promise<T[]> - Array of records
 * 
 * @example
 * ```typescript
 * const allCustomers = await findAll(customers, customers.createdAt);
 * sendSuccess(reply, allCustomers);
 * ```
 */
export async function findAll<T>(
  table: PgTable,
  orderBy?: any
): Promise<T[]> {
  const query = db.select().from(table);
  
  if (orderBy) {
    query.orderBy(orderBy);
  }
  
  return await query as T[];
}

/**
 * Get paginated records from a table
 * 
 * @param table - The database table to query
 * @param page - Page number (1-based)
 * @param limit - Number of records per page
 * @param where - Optional where conditions
 * @param orderBy - Optional field to order by
 * @returns Promise<T[]> - Array of records for the page
 * 
 * @example
 * ```typescript
 * const leads = await findPaginated(
 *   leads,
 *   page,
 *   limit,
 *   eq(leads.customerId, customerId),
 *   leads.createdAt
 * );
 * ```
 */
export async function findPaginated<T>(
  table: PgTable,
  page: number,
  limit: number,
  where?: SQL,
  orderBy?: any
): Promise<T[]> {
  const query = db.select().from(table);
  
  if (where) {
    query.where(where);
  }
  
  if (orderBy) {
    query.orderBy(orderBy);
  }
  
  query.limit(limit).offset((page - 1) * limit);
  
  return await query as T[];
}
