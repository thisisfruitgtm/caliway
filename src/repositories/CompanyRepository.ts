import { Company } from '../models';
import { BaseRepository } from './BaseRepository';

export interface ICompanyRepository {
  findById(id: string): Promise<Company | null>;
  findByShareableUrl(shareableUrl: string): Promise<Company | null>;
  create(companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>;
  update(id: string, companyData: Partial<Company>): Promise<Company | null>;
  delete(id: string): Promise<boolean>;
  isShareableUrlUnique(shareableUrl: string, excludeId?: string): Promise<boolean>;
}

export class CompanyRepository extends BaseRepository<Company> implements ICompanyRepository {
  constructor() {
    super('companies');
  }

  protected mapFromDatabase(data: any): Company {
    return {
      id: data.id,
      name: data.name,
      shareableUrl: data.shareable_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  protected mapToDatabase(data: any): any {
    const dbData: any = {};
    
    if (data.name !== undefined) dbData.name = data.name;
    if (data.shareableUrl !== undefined) dbData.shareable_url = data.shareableUrl;
    if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    if (data.updatedAt !== undefined) dbData.updated_at = data.updatedAt;
    
    return dbData;
  }

  async findByShareableUrl(shareableUrl: string): Promise<Company | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('shareable_url', shareableUrl)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find company by shareable URL: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async isShareableUrlUnique(shareableUrl: string, excludeId?: string): Promise<boolean> {
    let query = this.client
      .from(this.tableName)
      .select('id')
      .eq('shareable_url', shareableUrl);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to check shareable URL uniqueness: ${error.message}`);
    }

    return data.length === 0;
  }

  // Override create to validate shareable URL uniqueness
  async create(companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const isUnique = await this.isShareableUrlUnique(companyData.shareableUrl);
    if (!isUnique) {
      throw new Error('Shareable URL already exists');
    }

    return super.create(companyData);
  }

  // Override update to validate shareable URL uniqueness
  async update(id: string, companyData: Partial<Company>): Promise<Company | null> {
    if (companyData.shareableUrl) {
      const isUnique = await this.isShareableUrlUnique(companyData.shareableUrl, id);
      if (!isUnique) {
        throw new Error('Shareable URL already exists');
      }
    }

    return super.update(id, companyData);
  }
}