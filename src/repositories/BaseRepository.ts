import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

// Base repository interface for common CRUD operations
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

// Base repository implementation with common functionality
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected client: SupabaseClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.client = supabase;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to find ${this.tableName} by id: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async findAll(): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const dbData = this.mapToDatabase(data);
    
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
    }

    return this.mapFromDatabase(result);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const dbData = this.mapToDatabase(data);
    
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
    }

    return this.mapFromDatabase(result);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
    }

    return true;
  }

  // Abstract methods for data mapping between TypeScript and database formats
  protected abstract mapFromDatabase(data: any): T;
  protected abstract mapToDatabase(data: any): any;

  // Helper method for handling database errors
  protected handleError(operation: string, error: any): never {
    console.error(`${operation} error in ${this.tableName}:`, error);
    throw new Error(`${operation} failed: ${error.message}`);
  }

  // Helper method for pagination
  async findWithPagination(page: number = 1, limit: number = 10): Promise<{ data: T[], total: number, page: number, totalPages: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const { count, error: countError } = await this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count ${this.tableName}: ${countError.message}`);
    }

    // Get paginated data
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch paginated ${this.tableName}: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map(item => this.mapFromDatabase(item)),
      total,
      page,
      totalPages
    };
  }
}