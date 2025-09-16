import { WidgetConfig } from '../models';
import { BaseRepository } from './BaseRepository';
import { supabaseAdmin } from '../config/supabase';

export interface IWidgetConfigRepository {
  findByCompanyId(companyId: string): Promise<WidgetConfig | null>;
  create(configData: WidgetConfig): Promise<WidgetConfig>;
  update(companyId: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig | null>;
  delete(companyId: string): Promise<boolean>;
}

export class WidgetConfigRepository extends BaseRepository<WidgetConfig> implements IWidgetConfigRepository {
  constructor() {
    super('widget_configs');
    // Use admin client for widget configs to bypass RLS
    this.client = supabaseAdmin;
  }

  protected mapFromDatabase(data: any): WidgetConfig {
    return {
      companyId: data.company_id,
      theme: data.theme,
      primaryColor: data.primary_color,
      showUpcomingOnly: data.show_upcoming_only,
      maxEvents: data.max_events,
      dateFormat: data.date_format
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

  // Override create to use company_id as primary key
  async create(configData: WidgetConfig): Promise<WidgetConfig> {
    const dbData = this.mapToDatabase(configData);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create widget config: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  // Override update to use company_id as identifier
  async update(companyId: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig | null> {
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
      throw new Error(`Failed to update widget config: ${error.message}`);
    }

    return this.mapFromDatabase(data);
  }

  // Override delete to use company_id as identifier
  async delete(companyId: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      throw new Error(`Failed to delete widget config: ${error.message}`);
    }

    return true;
  }
}