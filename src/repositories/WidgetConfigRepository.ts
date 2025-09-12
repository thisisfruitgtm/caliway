import { WidgetConfig } from '../models';
import { BaseRepository } from './BaseRepository';

export interface IWidgetConfigRepository {
  findById(id: string): Promise<WidgetConfig | null>;
  findByCompanyId(companyId: string): Promise<WidgetConfig | null>;
  create(configData: Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<WidgetConfig>;
  update(id: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig | null>;
  updateByCompanyId(companyId: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig | null>;
  delete(id: string): Promise<boolean>;
  deleteByCompanyId(companyId: string): Promise<boolean>;
}

// Extended WidgetConfig interface for database operations
interface WidgetConfigWithId extends WidgetConfig {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class WidgetConfigRepository extends BaseRepository<WidgetConfigWithId> implements IWidgetConfigRepository {
  constructor() {
    super('widget_configs');
  }

  protected mapFromDatabase(data: any): WidgetConfigWithId {
    return {
      id: data.id,
      companyId: data.company_id,
      theme: data.theme,
      primaryColor: data.primary_color,
      showUpcomingOnly: data.show_upcoming_only,
      maxEvents: data.max_events,
      dateFormat: data.date_format,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  protected mapToDatabase(data: any): any {
    const dbData: any = {};
    
    if (data.companyId !== undefined) dbData.company_id = data.companyId;
    if (data.theme !== undefined) dbData.theme = data.theme;
    if (data.primaryColor !== undefined) dbData.primary_color = data.primaryColor;
    if (data.showUpcomingOnly !== undefined) dbData.show_upcoming_only = data.showUpcomingOnly;
    if (data.maxEvents !== undefined) dbData.max_events = data.maxEvents;
    if (data.dateFormat !== undefined) dbData.date_format = data.dateFormat;
    if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    if (data.updatedAt !== undefined) dbData.updated_at = data.updatedAt;
    
    return dbData;
  }

  async findByCompanyId(companyId: string): Promise<WidgetConfig | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find widget config by company ID: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async updateByCompanyId(companyId: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig | null> {
    const dbData = this.mapToDatabase(configData);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .update(dbData)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to update widget config by company ID: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  async deleteByCompanyId(companyId: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      throw new Error(`Failed to delete widget config by company ID: ${error.message}`);
    }

    return true;
  }

  // Create or update widget config for a company (upsert functionality)
  async upsertByCompanyId(companyId: string, configData: Omit<WidgetConfig, 'companyId'>): Promise<WidgetConfig> {
    const fullConfigData = {
      ...configData,
      companyId
    };

    const dbData = this.mapToDatabase(fullConfigData);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(dbData, { 
        onConflict: 'company_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert widget config: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  // Get default widget config for a company
  getDefaultConfig(companyId: string): WidgetConfig {
    return {
      companyId,
      theme: 'light',
      primaryColor: '#007bff',
      showUpcomingOnly: true,
      maxEvents: 10,
      dateFormat: 'YYYY-MM-DD'
    };
  }

  // Get widget config with fallback to defaults
  async findByCompanyIdWithDefaults(companyId: string): Promise<WidgetConfig> {
    const config = await this.findByCompanyId(companyId);
    
    if (!config) {
      return this.getDefaultConfig(companyId);
    }

    // Convert WidgetConfigWithId to WidgetConfig by extracting only the needed fields
    return {
      companyId: config.companyId,
      theme: config.theme,
      primaryColor: config.primaryColor,
      showUpcomingOnly: config.showUpcomingOnly,
      maxEvents: config.maxEvents,
      dateFormat: config.dateFormat
    };
  }
}