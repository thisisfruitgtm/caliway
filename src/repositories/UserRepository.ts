import { User } from '../models';
import { BaseRepository } from './BaseRepository';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByCompanyId(companyId: string): Promise<User[]>;
  create(userData: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>): Promise<User>;
  update(id: string, userData: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  updateLastLogin(id: string): Promise<User | null>;
}

export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor() {
    super('users');
  }

  protected mapFromDatabase(data: any): User {
    return {
      id: data.id,
      username: data.username,
      passwordHash: data.password_hash,
      companyId: data.company_id,
      createdAt: new Date(data.created_at),
      lastLoginAt: new Date(data.last_login_at)
    };
  }

  protected mapToDatabase(data: any): any {
    const dbData: any = {};
    
    if (data.username !== undefined) dbData.username = data.username;
    if (data.passwordHash !== undefined) dbData.password_hash = data.passwordHash;
    if (data.companyId !== undefined) dbData.company_id = data.companyId;
    if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    if (data.lastLoginAt !== undefined) dbData.last_login_at = data.lastLoginAt;
    
    return dbData;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find user by username: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async findByCompanyId(companyId: string): Promise<User[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find users by company ID: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  async updateLastLogin(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to update last login: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  // Override create to set default lastLoginAt
  async create(userData: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>): Promise<User> {
    const dataWithDefaults = {
      ...userData,
      lastLoginAt: new Date()
    };
    
    return super.create(dataWithDefaults);
  }
}