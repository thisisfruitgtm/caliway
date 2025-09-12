import { Event } from '../models';
import { BaseRepository } from './BaseRepository';

export interface IEventRepository {
  findById(id: string): Promise<Event | null>;
  findByCompanyId(companyId: string): Promise<Event[]>;
  findPublicByCompanyId(companyId: string): Promise<Event[]>;
  findUpcomingByCompanyId(companyId: string, limit?: number): Promise<Event[]>;
  findByDateRange(companyId: string, startDate: Date, endDate: Date): Promise<Event[]>;
  create(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>;
  update(id: string, eventData: Partial<Event>): Promise<Event | null>;
  delete(id: string): Promise<boolean>;
}

export class EventRepository extends BaseRepository<Event> implements IEventRepository {
  constructor() {
    super('events');
  }

  protected mapFromDatabase(data: any): Event {
    return {
      id: data.id,
      companyId: data.company_id,
      title: data.title,
      description: data.description,
      startDateTime: new Date(data.start_date_time),
      endDateTime: new Date(data.end_date_time),
      location: data.location || undefined,
      isPublic: data.is_public,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  protected mapToDatabase(data: any): any {
    const dbData: any = {};
    
    if (data.companyId !== undefined) dbData.company_id = data.companyId;
    if (data.title !== undefined) dbData.title = data.title;
    if (data.description !== undefined) dbData.description = data.description;
    if (data.startDateTime !== undefined) dbData.start_date_time = data.startDateTime;
    if (data.endDateTime !== undefined) dbData.end_date_time = data.endDateTime;
    if (data.location !== undefined) dbData.location = data.location;
    if (data.isPublic !== undefined) dbData.is_public = data.isPublic;
    if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    if (data.updatedAt !== undefined) dbData.updated_at = data.updatedAt;
    
    return dbData;
  }

  async findByCompanyId(companyId: string): Promise<Event[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .order('start_date_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to find events by company ID: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  async findPublicByCompanyId(companyId: string): Promise<Event[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .eq('is_public', true)
      .order('start_date_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to find public events by company ID: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  async findUpcomingByCompanyId(companyId: string, limit?: number): Promise<Event[]> {
    const now = new Date().toISOString();
    
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .gte('start_date_time', now)
      .order('start_date_time', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find upcoming events: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  async findByDateRange(companyId: string, startDate: Date, endDate: Date): Promise<Event[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .gte('start_date_time', startDate.toISOString())
      .lte('end_date_time', endDate.toISOString())
      .order('start_date_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to find events by date range: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  // Override findAll to order by start date
  async findAll(): Promise<Event[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('start_date_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }

  // Method to find events that need to be included in calendar feeds
  async findForCalendarFeed(companyId: string): Promise<Event[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('company_id', companyId)
      .eq('is_public', true)
      .order('start_date_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to find events for calendar feed: ${error.message}`);
    }

    return data.map(item => this.mapFromDatabase(item));
  }
}