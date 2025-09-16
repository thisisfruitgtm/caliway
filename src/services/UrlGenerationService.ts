import { Company, CalendarUrls } from '../models';
import { ICompanyRepository } from '../repositories/CompanyRepository';
import { validateCompany } from '../models/validation';
import { randomBytes } from 'crypto';

export interface IUrlGenerationService {
  generateShareableUrl(companyId: string): Promise<string>;
  getCompanyByShareUrl(shareUrl: string): Promise<Company | null>;
  generateCalendarSubscriptionUrls(shareUrl: string): CalendarUrls;
  generateEmbedCode(companyId: string, config?: EmbedConfig): Promise<string>;
  ensureCompanyHasShareableUrl(companyId: string): Promise<string>;
}

export interface EmbedConfig {
  theme?: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  maxEvents?: number;
  showUpcomingOnly?: boolean;
}

export class UrlGenerationService implements IUrlGenerationService {
  private readonly baseUrl: string;
  private readonly maxRetries = 10;

  constructor(
    private companyRepository: ICompanyRepository,
    baseUrl?: string
  ) {
    this.baseUrl = baseUrl || process.env.BASE_URL || 'http://caliway.thisisfruit.com';
  }

  /**
   * Generates a unique shareable URL for a company
   * If the company already has a shareable URL, returns the existing one
   */
  async generateShareableUrl(companyId: string): Promise<string> {
    // First check if company exists and already has a shareable URL
    const existingCompany = await this.companyRepository.findById(companyId);
    if (!existingCompany) {
      throw new Error('Company not found');
    }

    if (existingCompany.shareableUrl) {
      return existingCompany.shareableUrl;
    }

    // Generate a new unique shareable URL
    const shareableUrl = await this.generateUniqueUrl();
    
    // Update the company with the new shareable URL
    const updatedCompany = await this.companyRepository.update(companyId, {
      shareableUrl,
      updatedAt: new Date()
    });

    if (!updatedCompany) {
      throw new Error('Failed to update company with shareable URL');
    }

    return shareableUrl;
  }

  /**
   * Retrieves a company by its shareable URL
   */
  async getCompanyByShareUrl(shareUrl: string): Promise<Company | null> {
    if (!shareUrl || shareUrl.trim().length === 0) {
      return null;
    }

    return await this.companyRepository.findByShareableUrl(shareUrl);
  }

  /**
   * Generates calendar subscription URLs for different calendar applications
   */
  generateCalendarSubscriptionUrls(shareUrl: string): CalendarUrls {
    if (!shareUrl || shareUrl.trim().length === 0) {
      throw new Error('Share URL is required');
    }

    const baseCalendarUrl = `${this.baseUrl}/calendar/${shareUrl}`;
    const icalFeedUrl = `${baseCalendarUrl}/feed.ics`;
    
    // Encode the iCal feed URL for use in calendar application URLs
    const encodedFeedUrl = encodeURIComponent(icalFeedUrl);
    
    return {
      icalFeed: icalFeedUrl,
      googleCalendar: `https://calendar.google.com/calendar/render?cid=${encodedFeedUrl}`,
      outlookCalendar: `https://outlook.live.com/calendar/0/addcalendar?url=${encodedFeedUrl}`,
      appleCalendar: `webcal://${this.extractDomainAndPath(icalFeedUrl)}`
    };
  }

  /**
   * Generates embeddable JavaScript code for a company's calendar widget
   */
  async generateEmbedCode(companyId: string, config: EmbedConfig = {}): Promise<string> {
    // Ensure company exists and has a shareable URL
    const shareableUrl = await this.ensureCompanyHasShareableUrl(companyId);
    
    const widgetConfig = {
      theme: config.theme || 'auto',
      primaryColor: config.primaryColor || '#007bff',
      maxEvents: config.maxEvents || 5,
      showUpcomingOnly: config.showUpcomingOnly !== false
    };

    const widgetUrl = `${this.baseUrl}/widget/${shareableUrl}`;
    
    return `<!-- Company Calendar Widget -->
<div id="company-calendar-widget-${shareableUrl}"></div>
<script>
(function() {
  var config = ${JSON.stringify(widgetConfig, null, 2)};
  var script = document.createElement('script');
  script.src = '${this.baseUrl}/widget.js';
  script.onload = function() {
    if (window.CompanyCalendarWidget) {
      window.CompanyCalendarWidget.init('company-calendar-widget-${shareableUrl}', '${widgetUrl}', config);
    }
  };
  document.head.appendChild(script);
})();
</script>`;
  }

  /**
   * Ensures a company has a shareable URL, generating one if needed
   */
  async ensureCompanyHasShareableUrl(companyId: string): Promise<string> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (company.shareableUrl) {
      return company.shareableUrl;
    }

    return await this.generateShareableUrl(companyId);
  }

  /**
   * Generates a unique URL slug for sharing
   */
  private async generateUniqueUrl(): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const urlSlug = this.generateUrlSlug();
      
      const isUnique = await this.companyRepository.isShareableUrlUnique(urlSlug);
      if (isUnique) {
        return urlSlug;
      }
    }

    throw new Error('Failed to generate unique shareable URL after maximum retries');
  }

  /**
   * Generates a random URL slug
   */
  private generateUrlSlug(): string {
    // Generate a random string using crypto for security
    const randomString = randomBytes(8).toString('hex');
    
    // Add a timestamp component to reduce collision probability
    const timestamp = Date.now().toString(36);
    
    // Combine and ensure it's URL-safe
    return `cal-${timestamp}-${randomString}`;
  }

  /**
   * Extracts domain and path from a URL for webcal protocol
   */
  private extractDomainAndPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.host}${urlObj.pathname}${urlObj.search}`;
    } catch (error) {
      throw new Error('Invalid URL provided for webcal conversion');
    }
  }

  /**
   * Validates a shareable URL format
   */
  static validateShareableUrl(shareableUrl: string): boolean {
    if (!shareableUrl || shareableUrl.trim().length === 0) {
      return false;
    }

    // Check length constraints
    if (shareableUrl.length < 10 || shareableUrl.length > 200) {
      return false;
    }

    // Check format - should start with 'cal-' and contain only URL-safe characters
    const urlPattern = /^cal-[a-z0-9\-]+$/i;
    return urlPattern.test(shareableUrl);
  }
}