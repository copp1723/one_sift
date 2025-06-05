import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  findById,
  findByField,
  exists,
  notExists,
  verifyCustomer,
  verifyActiveCustomer,
  buildPaginationQuery,
  countRecords,
  buildFilteredQuery,
  transaction,
  EntityNotFoundError
} from '../database.js';
import { db } from '../../db/index.js';
import { customers } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// Mock database module
jest.mock('../../db/index.js');

describe('Database Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    const mockTable = {
      id: 'id-column',
      _: { name: 'test_table' }
    };

    test('should return entity when found', async () => {
      const mockEntity = { id: '123', name: 'Test Entity' };
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([mockEntity]);

      const result = await findById(mockTable, '123');
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockEntity);
    });

    test('should return null when entity not found', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      const result = await findById(mockTable, '123');
      
      expect(result).toBeNull();
    });

    test('should throw EntityNotFoundError when not found and throwIfNotFound is true', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      await expect(findById(mockTable, '123', { throwIfNotFound: true }))
        .rejects.toThrow(EntityNotFoundError);
      
      await expect(findById(mockTable, '123', { throwIfNotFound: true }))
        .rejects.toThrow('test_table with ID 123 not found');
    });

    test('should use custom error message when provided', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      await expect(findById(mockTable, '123', { 
        throwIfNotFound: true,
        errorMessage: 'Custom error message'
      })).rejects.toThrow('Custom error message');
    });
  });

  describe('findByField', () => {
    const mockTable = {
      name: 'name-column',
      _: { name: 'test_table' }
    };

    test('should return entity when found by field', async () => {
      const mockEntity = { id: '123', name: 'Test Entity' };
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([mockEntity]);

      const result = await findByField(mockTable, 'name', 'Test Entity');
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockEntity);
    });

    test('should return null when entity not found by field', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      const result = await findByField(mockTable, 'name', 'Nonexistent');
      
      expect(result).toBeNull();
    });

    test('should throw EntityNotFoundError when not found by field and throwIfNotFound is true', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      await expect(findByField(mockTable, 'name', 'Nonexistent', { throwIfNotFound: true }))
        .rejects.toThrow(EntityNotFoundError);
      
      await expect(findByField(mockTable, 'name', 'Nonexistent', { throwIfNotFound: true }))
        .rejects.toThrow('test_table with ID name:Nonexistent not found');
    });
  });

  describe('exists', () => {
    const mockTable = { _: { name: 'test_table' } };

    test('should return true when entity exists', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([{ exists: true }]);

      const result = await exists(mockTable, '123');
      
      expect(db.select).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should return false when entity does not exist', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([{ exists: false }]);

      const result = await exists(mockTable, '123');
      
      expect(result).toBe(false);
    });

    test('should handle empty result', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      const result = await exists(mockTable, '123');
      
      expect(result).toBe(false);
    });
  });

  describe('notExists', () => {
    const mockTable = { _: { name: 'test_table' } };

    test('should return true when entity does not exist', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([{ exists: false }]);

      const result = await notExists(mockTable, 'slug', 'test-slug');
      
      expect(db.select).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should return false when entity exists', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([{ exists: true }]);

      const result = await notExists(mockTable, 'slug', 'test-slug');
      
      expect(result).toBe(false);
    });

    test('should handle empty result', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      const result = await notExists(mockTable, 'slug', 'test-slug');
      
      expect(result).toBe(true);
    });
  });

  describe('verifyCustomer', () => {
    test('should return customer when found', async () => {
      const mockCustomer = { id: '123', name: 'Test Customer' };
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([mockCustomer]);

      const result = await verifyCustomer('123');
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(customers);
      expect(result).toEqual(mockCustomer);
    });

    test('should return null when customer not found', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      const result = await verifyCustomer('123');
      
      expect(result).toBeNull();
    });

    test('should throw EntityNotFoundError when customer not found and throwIfNotFound is true', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      await expect(verifyCustomer('123', { throwIfNotFound: true }))
        .rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('verifyActiveCustomer', () => {
    test('should return customer when found and active', async () => {
      const mockCustomer = { id: '123', name: 'Test Customer', isActive: true };
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([mockCustomer]);

      const result = await verifyActiveCustomer('123');
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(customers);
      expect(result).toEqual(mockCustomer);
    });

    test('should throw EntityNotFoundError when customer not found', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([]);

      await expect(verifyActiveCustomer('123'))
        .rejects.toThrow(EntityNotFoundError);
    });

    test('should throw Error when customer is inactive', async () => {
      const mockCustomer = { id: '123', name: 'Test Customer', isActive: false };
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();
      jest.spyOn(db, 'limit').mockResolvedValue([mockCustomer]);

      await expect(verifyActiveCustomer('123'))
        .rejects.toThrow('Customer account is inactive');
    });
  });

  describe('buildPaginationQuery', () => {
    test('should add pagination to query', () => {
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis()
      };

      buildPaginationQuery(mockQuery, 2, 10);
      
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(10); // (2-1) * 10
    });

    test('should use default pagination values', () => {
      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis()
      };

      buildPaginationQuery(mockQuery);
      
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.offset).toHaveBeenCalledWith(0); // (1-1) * 20
    });
  });

  describe('countRecords', () => {
    const mockTable = { _: { name: 'test_table' } };

    test('should count records with no conditions', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockImplementation(() => {
        throw new Error('where should not be called');
      });
      jest.spyOn(db.fn, 'count').mockReturnValue({ count: jest.fn() });
      
      // Mock the query result
      const mockResult = [{ count: 10 }];
      jest.spyOn(Promise, 'resolve').mockImplementation(() => Promise.resolve(mockResult));

      const result = await countRecords(mockTable);
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
      expect(result).toBe(10);
    });

    test('should count records with conditions', async () => {
      const mockConditions = [eq('column', 'value')];
      
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockResolvedValue([{ count: 5 }]);
      jest.spyOn(db.fn, 'count').mockReturnValue({ count: jest.fn() });

      const result = await countRecords(mockTable, mockConditions);
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
      expect(db.where).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    test('should handle null count result', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockResolvedValue([{ count: null }]);
      jest.spyOn(db.fn, 'count').mockReturnValue({ count: jest.fn() });

      const result = await countRecords(mockTable);
      
      expect(result).toBe(0);
    });

    test('should handle empty result', async () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockResolvedValue([]);
      jest.spyOn(db.fn, 'count').mockReturnValue({ count: jest.fn() });

      const result = await countRecords(mockTable);
      
      expect(result).toBe(0);
    });
  });

  describe('buildFilteredQuery', () => {
    const mockTable = { _: { name: 'test_table' } };

    test('should build query with no conditions', () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockImplementation(() => {
        throw new Error('where should not be called');
      });

      const result = buildFilteredQuery(mockTable);
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
    });

    test('should build query with conditions', () => {
      const mockConditions = [eq('column', 'value')];
      
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockReturnThis();

      const result = buildFilteredQuery(mockTable, mockConditions);
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
      expect(db.where).toHaveBeenCalled();
    });

    test('should handle empty conditions array', () => {
      jest.spyOn(db, 'select').mockReturnThis();
      jest.spyOn(db, 'from').mockReturnThis();
      jest.spyOn(db, 'where').mockImplementation(() => {
        throw new Error('where should not be called');
      });

      const result = buildFilteredQuery(mockTable, []);
      
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(mockTable);
    });
  });

  describe('transaction', () => {
    test('should execute callback within transaction', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      jest.spyOn(db, 'transaction').mockImplementation((cb) => cb(db));

      const result = await transaction(mockCallback);
      
      expect(db.transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(db);
      expect(result).toBe('result');
    });

    test('should propagate errors from callback', async () => {
      const mockError = new Error('Transaction error');
      const mockCallback = jest.fn().mockRejectedValue(mockError);
      jest.spyOn(db, 'transaction').mockImplementation((cb) => cb(db));

      await expect(transaction(mockCallback))
        .rejects.toThrow('Transaction error');
      
      expect(db.transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(db);
    });
  });

  describe('EntityNotFoundError', () => {
    test('should create error with entity name and ID', () => {
      const error = new EntityNotFoundError('Customer', '123');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('EntityNotFoundError');
      expect(error.message).toBe('Customer with ID 123 not found');
    });

    test('should create error with only entity name', () => {
      const error = new EntityNotFoundError('Customer');
      
      expect(error.message).toBe('Customer with ID undefined not found');
    });
  });
});
