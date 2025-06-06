/**
 * Database Utilities Tests
 * 
 * Comprehensive unit tests for database utility functions.
 * Tests cover all utility functions with various scenarios including
 * success cases, error cases, and edge cases.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  findById,
  findByField,
  checkExists,
  createWithConflictCheck,
  updateById,
  findAll,
  findPaginated
} from '../../../src/utils/database.js';

// Mock the database
vi.mock('../../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn()
  }
}));

// Import the mocked db
import { db } from '../../../src/db/index.js';

// Mock table structure
const mockTable = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  createdAt: 'created_at'
} as any;

describe('Database Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should return record when found', async () => {
      const mockRecord = { id: '123', name: 'Test' };
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRecord])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findById(mockTable, '123');

      expect(result).toEqual(mockRecord);
      expect(db.select).toHaveBeenCalled();
      expect(mockQuery.from).toHaveBeenCalledWith(mockTable);
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when record not found', async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findById(mockTable, '123');

      expect(result).toBeNull();
    });
  });

  describe('findByField', () => {
    it('should return record when found by field', async () => {
      const mockRecord = { id: '123', slug: 'test-slug' };
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRecord])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findByField(mockTable, mockTable.slug, 'test-slug');

      expect(result).toEqual(mockRecord);
      expect(db.select).toHaveBeenCalled();
      expect(mockQuery.from).toHaveBeenCalledWith(mockTable);
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when record not found by field', async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findByField(mockTable, mockTable.slug, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('checkExists', () => {
    it('should return true when record exists', async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: '123' }])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await checkExists(mockTable, mockTable.slug, 'test-slug');

      expect(result).toBe(true);
    });

    it('should return false when record does not exist', async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };
      
      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await checkExists(mockTable, mockTable.slug, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createWithConflictCheck', () => {
    it('should create record successfully when no conflict', async () => {
      const mockData = { name: 'Test', slug: 'test-slug' };
      const mockCreatedRecord = { id: '123', ...mockData };

      // Mock conflict check (no existing record)
      const mockSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };
      
      // Mock insert
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedRecord])
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);
      (db.insert as Mock).mockReturnValue(mockInsertQuery);

      const result = await createWithConflictCheck(
        mockTable,
        mockData,
        mockTable.slug,
        'test-slug'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedRecord);
      expect(result.error).toBeUndefined();
    });

    it('should return conflict error when record exists', async () => {
      const mockData = { name: 'Test', slug: 'test-slug' };

      // Mock conflict check (existing record found)
      const mockSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: '123' }])
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const result = await createWithConflictCheck(
        mockTable,
        mockData,
        mockTable.slug,
        'test-slug'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record with this value already exists');
      expect(result.data).toBeUndefined();
    });

    it('should create record without conflict check when no conflict field provided', async () => {
      const mockData = { name: 'Test' };
      const mockCreatedRecord = { id: '123', ...mockData };

      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedRecord])
      };

      (db.insert as Mock).mockReturnValue(mockInsertQuery);

      const result = await createWithConflictCheck(mockTable, mockData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedRecord);
    });

    it('should handle database errors gracefully', async () => {
      const mockData = { name: 'Test' };
      const mockError = new Error('Database connection failed');

      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(mockError)
      };

      (db.insert as Mock).mockReturnValue(mockInsertQuery);

      const result = await createWithConflictCheck(mockTable, mockData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.data).toBeUndefined();
    });
  });

  describe('updateById', () => {
    it('should update record successfully when record exists', async () => {
      const mockUpdateData = { name: 'Updated Name' };
      const mockUpdatedRecord = { id: '123', name: 'Updated Name', updatedAt: expect.any(Date) };

      const mockUpdateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdatedRecord])
      };

      (db.update as Mock).mockReturnValue(mockUpdateQuery);

      const result = await updateById(mockTable, '123', mockUpdateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedRecord);
      expect(result.error).toBeUndefined();
      expect(mockUpdateQuery.set).toHaveBeenCalledWith({
        ...mockUpdateData,
        updatedAt: expect.any(Date)
      });
    });

    it('should return not found error when record does not exist', async () => {
      const mockUpdateData = { name: 'Updated Name' };

      const mockUpdateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([])
      };

      (db.update as Mock).mockReturnValue(mockUpdateQuery);

      const result = await updateById(mockTable, '123', mockUpdateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record not found');
      expect(result.data).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      const mockUpdateData = { name: 'Updated Name' };
      const mockError = new Error('Database connection failed');

      const mockUpdateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(mockError)
      };

      (db.update as Mock).mockReturnValue(mockUpdateQuery);

      const result = await updateById(mockTable, '123', mockUpdateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.data).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return all records without ordering', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' }
      ];

      const mockQuery = {
        from: vi.fn().mockResolvedValue(mockRecords)
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findAll(mockTable);

      expect(result).toEqual(mockRecords);
      expect(db.select).toHaveBeenCalled();
      expect(mockQuery.from).toHaveBeenCalledWith(mockTable);
    });

    it('should return all records with ordering', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' }
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockRecords)
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findAll(mockTable, mockTable.createdAt);

      expect(result).toEqual(mockRecords);
      expect(mockQuery.orderBy).toHaveBeenCalledWith(mockTable.createdAt);
    });
  });

  describe('findPaginated', () => {
    it('should return paginated records with all options', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' }
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockRecords)
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const whereCondition = eq(mockTable.id, '123');
      const result = await findPaginated(
        mockTable,
        2, // page
        10, // limit
        whereCondition,
        mockTable.createdAt
      );

      expect(result).toEqual(mockRecords);
      expect(mockQuery.where).toHaveBeenCalledWith(whereCondition);
      expect(mockQuery.orderBy).toHaveBeenCalledWith(mockTable.createdAt);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(10); // (page - 1) * limit = (2 - 1) * 10 = 10
    });

    it('should return paginated records without where and orderBy', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' }
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockRecords)
      };

      (db.select as Mock).mockReturnValue(mockQuery);

      const result = await findPaginated(mockTable, 1, 5);

      expect(result).toEqual(mockRecords);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(mockQuery.offset).toHaveBeenCalledWith(0); // (1 - 1) * 5 = 0
    });
  });
});
