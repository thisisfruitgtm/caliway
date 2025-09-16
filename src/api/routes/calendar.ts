import { Router, Request, Response } from 'express';
import { UrlGenerationService } from '../../services/UrlGenerationService';
import { CalendarFeedService } from '../../services/CalendarFeedService';
import { CompanyRepository, EventRepository } from '../../repositories';
import { authMiddleware } from '../middleware/auth';
import { cacheService } from '../../services/CacheService';
import { publicFeedRateLimit, publicViewRateLimit, apiRateLimit } from '../middleware/rateLimiting';
import { securityMiddleware, validateShareUrl, securityHeaders, preventDataExposure, securityLogger } from '../middleware/security';

export interface ShareUrlResponse {
  success: boolean;
  shareableUrl?: string;
  calendarUrls?: {
    icalFeed: string;
    googleCalendar: string;
    outlookCalendar: string;
    appleCalendar: string;
  };
  embedCode?: string;
  error?: string;
}

export class CalendarRoutes {
  private router: Router;
  private urlService: UrlGenerationService;
  private feedService: CalendarFeedService;
  private static instance: CalendarRoutes;

  constructor() {
    this.router = Router();
    const companyRepository = new CompanyRepository();
    const eventRepository = new EventRepository();
    this.urlService = new UrlGenerationService(companyRepository);
    this.feedService = new CalendarFeedService(eventRepository);
    this.setupRoutes();
    
    // Set static instance for cache invalidation
    CalendarRoutes.instance = this;
  }

  private setupRoutes() {
    // Apply security middleware to all routes
    this.router.use(securityLogger);
    this.router.use(securityHeaders);
    this.router.use(securityMiddleware);

    // Calendar sharing page (GET)
    this.router.get('/calendar/share',
      authMiddleware.requireAuth({ redirectUrl: '/login' }),
      this.renderSharePage.bind(this)
    );

    // Public calendar feed endpoints (no authentication required)
    this.router.get('/calendar/:shareUrl/feed.ics',
      validateShareUrl,
      publicFeedRateLimit,
      preventDataExposure,
      this.getICalFeed.bind(this)
    );

    this.router.get('/calendar/:shareUrl/feed',
      validateShareUrl,
      publicFeedRateLimit,
      preventDataExposure,
      this.getICalFeed.bind(this)
    );

    // Public calendar view (no authentication required)
    this.router.get('/calendar/:shareUrl',
      validateShareUrl,
      publicViewRateLimit,
      preventDataExposure,
      this.getPublicCalendarView.bind(this)
    );

    // API Routes - all require authentication and rate limiting
    this.router.get('/api/calendar/share-url',
      apiRateLimit,
      authMiddleware.requireAuth({ returnJson: true }),
      preventDataExposure,
      this.getShareableUrl.bind(this)
    );

    this.router.post('/api/calendar/generate-url',
      apiRateLimit,
      authMiddleware.requireAuth({ returnJson: true }),
      preventDataExposure,
      this.generateShareableUrl.bind(this)
    );

    this.router.get('/api/calendar/subscription-urls/:shareUrl',
      apiRateLimit,
      validateShareUrl,
      authMiddleware.requireAuth({ returnJson: true }),
      preventDataExposure,
      this.getSubscriptionUrls.bind(this)
    );

    this.router.get('/api/calendar/embed-code',
      apiRateLimit,
      authMiddleware.requireAuth({ returnJson: true }),
      preventDataExposure,
      this.getEmbedCode.bind(this)
    );

    // Cache invalidation endpoint (authenticated)
    this.router.post('/api/calendar/invalidate-cache',
      apiRateLimit,
      authMiddleware.requireAuth({ returnJson: true }),
      this.invalidateCache.bind(this)
    );
  }

  /**
   * Render calendar sharing page
   */
  private renderSharePage(req: Request, res: Response) {
    const user = req.user!;
    
    const shareHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Company Calendar - Share Calendar</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background: #f5f5f5;
            }
            .header {
                background: white;
                padding: 1rem 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .header h1 {
                margin: 0;
                color: #333;
            }
            .nav-links {
                display: flex;
                gap: 1rem;
                align-items: center;
            }
            .nav-link {
                color: #667eea;
                text-decoration: none;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                transition: background-color 0.3s;
            }
            .nav-link:hover {
                background: #f0f0f0;
            }
            .logout-button {
                background: #dc3545;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                cursor: pointer;
            }
            .logout-button:hover {
                background: #c82333;
            }
            .main-content {
                padding: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            .page-header {
                margin-bottom: 2rem;
            }
            .page-header h2 {
                margin: 0 0 0.5rem 0;
                color: #333;
            }
            .page-header p {
                margin: 0;
                color: #666;
            }
            .share-section {
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 2rem;
                overflow: hidden;
            }
            .section-header {
                background: #f8f9fa;
                padding: 1.5rem;
                border-bottom: 1px solid #dee2e6;
            }
            .section-header h3 {
                margin: 0 0 0.5rem 0;
                color: #333;
            }
            .section-header p {
                margin: 0;
                color: #666;
                font-size: 0.9rem;
            }
            .section-content {
                padding: 1.5rem;
            }
            .url-display {
                display: flex;
                gap: 1rem;
                align-items: center;
                margin-bottom: 1rem;
            }
            .url-input {
                flex: 1;
                padding: 0.75rem;
                border: 2px solid #e1e5e9;
                border-radius: 5px;
                font-size: 1rem;
                background: #f8f9fa;
                color: #333;
            }
            .copy-button {
                background: #667eea;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
                white-space: nowrap;
            }
            .copy-button:hover {
                background: #5a6fd8;
            }
            .copy-button.copied {
                background: #28a745;
            }
            .generate-button {
                background: #28a745;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
            }
            .generate-button:hover {
                background: #218838;
            }
            .generate-button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .calendar-buttons {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }
            .calendar-button {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                border: 2px solid #e1e5e9;
                border-radius: 5px;
                text-decoration: none;
                color: #333;
                transition: all 0.3s;
                background: white;
            }
            .calendar-button:hover {
                border-color: #667eea;
                background: #f8f9ff;
            }
            .calendar-icon {
                width: 24px;
                height: 24px;
                border-radius: 4px;
            }
            .google-icon {
                background: #4285f4;
            }
            .outlook-icon {
                background: #0078d4;
            }
            .apple-icon {
                background: #000;
            }
            .ical-icon {
                background: #666;
            }
            .loading {
                text-align: center;
                padding: 2rem;
                color: #666;
            }
            .error-message {
                background: #fee;
                color: #c33;
                padding: 1rem;
                border-radius: 5px;
                margin-bottom: 1rem;
                border: 1px solid #fcc;
            }
            .success-message {
                background: #efe;
                color: #363;
                padding: 1rem;
                border-radius: 5px;
                margin-bottom: 1rem;
                border: 1px solid #cfc;
            }
            .embed-code {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 5px;
                padding: 1rem;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.9rem;
                white-space: pre-wrap;
                word-break: break-all;
                max-height: 200px;
                overflow-y: auto;
            }
            .no-url-state {
                text-align: center;
                padding: 2rem;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Company Calendar</h1>
            <div class="nav-links">
                <a href="/dashboard" class="nav-link">Dashboard</a>
                <a href="/events" class="nav-link">Events</a>
                <a href="/calendar/share" class="nav-link">Share</a>
                <a href="/widget" class="nav-link">Widget</a>
                <button class="logout-button" onclick="logout()">Logout</button>
            </div>
        </div>
        
        <div class="main-content">
            <div class="page-header">
                <h2>Share Your Calendar</h2>
                <p>Generate shareable URLs and subscription links for your company calendar.</p>
            </div>
            
            <div id="message-container"></div>
            
            <!-- Shareable URL Section -->
            <div class="share-section">
                <div class="section-header">
                    <h3>📅 Shareable Calendar URL</h3>
                    <p>Generate a public URL that allows external users to view your calendar events.</p>
                </div>
                <div class="section-content" id="shareable-url-content">
                    <div class="loading">Loading shareable URL...</div>
                </div>
            </div>
            
            <!-- Calendar Subscription Section -->
            <div class="share-section" id="subscription-section" style="display: none;">
                <div class="section-header">
                    <h3>📲 Calendar Subscriptions</h3>
                    <p>Add your calendar to popular calendar applications for automatic updates.</p>
                </div>
                <div class="section-content" id="subscription-content">
                    <div class="calendar-buttons" id="calendar-buttons">
                        <!-- Calendar buttons will be populated here -->
                    </div>
                </div>
            </div>
            
            <!-- Embed Code Section -->
            <div class="share-section" id="embed-section" style="display: none;">
                <div class="section-header">
                    <h3>🔗 Embed Widget</h3>
                    <p>Copy this code to embed a calendar widget on your website.</p>
                </div>
                <div class="section-content" id="embed-content">
                    <div class="url-display">
                        <div class="embed-code" id="embed-code">
                            <!-- Embed code will be populated here -->
                        </div>
                    </div>
                    <button class="copy-button" onclick="copyEmbedCode()">Copy Embed Code</button>
                </div>
            </div>
        </div>

        <script>
            let currentShareableUrl = null;
            let calendarUrls = null;

            // Load shareable URL on page load
            document.addEventListener('DOMContentLoaded', loadShareableUrl);

            async function loadShareableUrl() {
                try {
                    const response = await fetch('/api/calendar/share-url');
                    const result = await response.json();
                    
                    if (result.success && result.shareableUrl) {
                        currentShareableUrl = result.shareableUrl;
                        renderShareableUrl();
                        await loadSubscriptionUrls();
                        await loadEmbedCode();
                    } else {
                        renderNoUrl();
                    }
                } catch (error) {
                    showError('Failed to load shareable URL. Please refresh the page.');
                }
            }

            function renderShareableUrl() {
                const content = document.getElementById('shareable-url-content');
                const fullUrl = window.location.origin + '/calendar/' + currentShareableUrl;
                
                content.innerHTML = \`
                    <div class="url-display">
                        <input type="text" class="url-input" value="\${fullUrl}" readonly>
                        <button class="copy-button" onclick="copyShareableUrl()">Copy URL</button>
                    </div>
                    <p style="color: #666; font-size: 0.9rem; margin: 0;">
                        Share this URL with external users to let them view your public calendar events.
                    </p>
                \`;
                
                document.getElementById('subscription-section').style.display = 'block';
                document.getElementById('embed-section').style.display = 'block';
            }

            function renderNoUrl() {
                const content = document.getElementById('shareable-url-content');
                
                content.innerHTML = \`
                    <div class="no-url-state">
                        <p>No shareable URL has been generated yet.</p>
                        <button class="generate-button" onclick="generateShareableUrl()">Generate Shareable URL</button>
                    </div>
                \`;
            }

            async function generateShareableUrl() {
                const button = event.target;
                button.disabled = true;
                button.textContent = 'Generating...';
                
                try {
                    const response = await fetch('/api/calendar/generate-url', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success && result.shareableUrl) {
                        currentShareableUrl = result.shareableUrl;
                        renderShareableUrl();
                        await loadSubscriptionUrls();
                        await loadEmbedCode();
                        showSuccess('Shareable URL generated successfully!');
                    } else {
                        showError(result.error || 'Failed to generate shareable URL');
                    }
                } catch (error) {
                    showError('Network error. Please try again.');
                } finally {
                    button.disabled = false;
                    button.textContent = 'Generate Shareable URL';
                }
            }

            async function loadSubscriptionUrls() {
                if (!currentShareableUrl) return;
                
                try {
                    const response = await fetch(\`/api/calendar/subscription-urls/\${currentShareableUrl}\`);
                    const result = await response.json();
                    
                    if (result.success && result.calendarUrls) {
                        calendarUrls = result.calendarUrls;
                        renderCalendarButtons();
                    }
                } catch (error) {
                    console.error('Failed to load subscription URLs:', error);
                }
            }

            function renderCalendarButtons() {
                if (!calendarUrls) return;
                
                const buttonsContainer = document.getElementById('calendar-buttons');
                
                buttonsContainer.innerHTML = \`
                    <a href="\${calendarUrls.googleCalendar}" target="_blank" class="calendar-button">
                        <div class="calendar-icon google-icon"></div>
                        <span>Add to Google Calendar</span>
                    </a>
                    <a href="\${calendarUrls.outlookCalendar}" target="_blank" class="calendar-button">
                        <div class="calendar-icon outlook-icon"></div>
                        <span>Add to Outlook</span>
                    </a>
                    <a href="\${calendarUrls.appleCalendar}" class="calendar-button">
                        <div class="calendar-icon apple-icon"></div>
                        <span>Add to Apple Calendar</span>
                    </a>
                    <a href="\${calendarUrls.icalFeed}" target="_blank" class="calendar-button">
                        <div class="calendar-icon ical-icon"></div>
                        <span>Download iCal Feed</span>
                    </a>
                \`;
            }

            async function loadEmbedCode() {
                try {
                    const response = await fetch('/api/calendar/embed-code');
                    const result = await response.json();
                    
                    if (result.success && result.embedCode) {
                        document.getElementById('embed-code').textContent = result.embedCode;
                    }
                } catch (error) {
                    console.error('Failed to load embed code:', error);
                }
            }

            async function copyShareableUrl() {
                const fullUrl = window.location.origin + '/calendar/' + currentShareableUrl;
                await copyToClipboard(fullUrl, event.target);
            }

            async function copyEmbedCode() {
                const embedCode = document.getElementById('embed-code').textContent;
                await copyToClipboard(embedCode, event.target);
            }

            async function copyToClipboard(text, button) {
                try {
                    await navigator.clipboard.writeText(text);
                    
                    const originalText = button.textContent;
                    button.textContent = 'Copied!';
                    button.classList.add('copied');
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                } catch (error) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    showSuccess('Copied to clipboard!');
                }
            }

            function showError(message) {
                const container = document.getElementById('message-container');
                container.innerHTML = \`<div class="error-message">\${escapeHtml(message)}</div>\`;
                setTimeout(() => container.innerHTML = '', 5000);
            }

            function showSuccess(message) {
                const container = document.getElementById('message-container');
                container.innerHTML = \`<div class="success-message">\${escapeHtml(message)}</div>\`;
                setTimeout(() => container.innerHTML = '', 5000);
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            async function logout() {
                try {
                    const response = await fetch('/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    if (response.ok) {
                        window.location.href = '/login';
                    } else {
                        alert('Logout failed. Please try again.');
                    }
                } catch (error) {
                    alert('Network error. Please try again.');
                }
            }
        </script>
    </body>
    </html>
    `;

    res.send(shareHtml);
  }

  /**
   * Get the current shareable URL for the user's company
   */
  private async getShareableUrl(req: Request, res: Response) {
    try {
      const user = req.user!;
      const shareableUrl = await this.urlService.ensureCompanyHasShareableUrl(user.companyId);

      return res.json({
        success: true,
        shareableUrl
      } as ShareUrlResponse);
    } catch (error) {
      console.error('Get shareable URL error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve shareable URL'
      } as ShareUrlResponse);
    }
  }

  /**
   * Generate a new shareable URL for the user's company
   */
  private async generateShareableUrl(req: Request, res: Response) {
    try {
      const user = req.user!;
      const shareableUrl = await this.urlService.generateShareableUrl(user.companyId);

      return res.json({
        success: true,
        shareableUrl
      } as ShareUrlResponse);
    } catch (error) {
      console.error('Generate shareable URL error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate shareable URL'
      } as ShareUrlResponse);
    }
  }

  /**
   * Get calendar subscription URLs for a given shareable URL
   */
  private async getSubscriptionUrls(req: Request, res: Response) {
    try {
      const { shareUrl } = req.params;
      const user = req.user!;

      // Verify the share URL belongs to the user's company
      const company = await this.urlService.getCompanyByShareUrl(shareUrl);
      if (!company || company.id !== user.companyId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        } as ShareUrlResponse);
      }

      const calendarUrls = this.urlService.generateCalendarSubscriptionUrls(shareUrl);

      return res.json({
        success: true,
        calendarUrls
      } as ShareUrlResponse);
    } catch (error) {
      console.error('Get subscription URLs error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate subscription URLs'
      } as ShareUrlResponse);
    }
  }

  /**
   * Get embed code for the user's company calendar
   */
  private async getEmbedCode(req: Request, res: Response) {
    try {
      const user = req.user!;
      const embedCode = await this.urlService.generateEmbedCode(user.companyId);

      return res.json({
        success: true,
        embedCode
      } as ShareUrlResponse);
    } catch (error) {
      console.error('Get embed code error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate embed code'
      } as ShareUrlResponse);
    }
  }

  /**
   * Get iCal feed for a company's public calendar
   */
  private async getICalFeed(req: Request, res: Response) {
    try {
      const { shareUrl } = req.params;

      // Get company by share URL
      const company = await this.urlService.getCompanyByShareUrl(shareUrl);
      if (!company) {
        return res.status(404).send('Calendar not found');
      }

      // Generate feed (caching is handled internally by the service)
      const icalFeed = await this.feedService.generateICalFeed(company.id);
      
      // Check if this was a cache hit by comparing with fresh generation
      const cacheHit = cacheService.getCachedFeed(company.id) === icalFeed;

      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${company.name}-calendar.ics"`,
        'Cache-Control': 'public, max-age=900', // 15 minutes
        'X-Cache': cacheHit ? 'HIT' : 'MISS'
      });

      return res.send(icalFeed);
    } catch (error) {
      console.error('Get iCal feed error:', error);
      return res.status(500).send('Internal server error');
    }
  }

  /**
   * Get public calendar view for a company
   */
  private async getPublicCalendarView(req: Request, res: Response): Promise<void | Response> {
    try {
      const { shareUrl } = req.params;

      // Get company by share URL
      const company = await this.urlService.getCompanyByShareUrl(shareUrl);
      if (!company) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
              <title>Calendar Not Found</title>
              <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                  h1 { color: #333; }
              </style>
          </head>
          <body>
              <h1>Calendar Not Found</h1>
              <p>The calendar you're looking for doesn't exist or has been removed.</p>
          </body>
          </html>
        `);
      }

      // Get public events
      const events = await this.feedService.getPublicEvents(company.id);
      
      // Generate calendar subscription URLs
      const calendarUrls = this.urlService.generateCalendarSubscriptionUrls(shareUrl);

      const publicCalendarHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${company.name} - Public Calendar</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  margin: 0;
                  padding: 0;
                  background: #f5f5f5;
                  line-height: 1.6;
              }
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 2rem;
                  text-align: center;
              }
              .header h1 {
                  margin: 0 0 0.5rem 0;
                  font-size: 2.5rem;
                  font-weight: 300;
              }
              .header p {
                  margin: 0;
                  opacity: 0.9;
                  font-size: 1.1rem;
              }
              .main-content {
                  max-width: 1200px;
                  margin: 0 auto;
                  padding: 2rem;
              }
              .subscription-section {
                  background: white;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  padding: 2rem;
                  margin-bottom: 2rem;
                  text-align: center;
              }
              .subscription-section h2 {
                  margin: 0 0 1rem 0;
                  color: #333;
              }
              .subscription-section p {
                  color: #666;
                  margin-bottom: 2rem;
              }
              .calendar-buttons {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 1rem;
                  max-width: 800px;
                  margin: 0 auto;
              }
              .calendar-button {
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                  padding: 1rem 1.5rem;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  text-decoration: none;
                  color: #333;
                  transition: all 0.3s;
                  background: white;
                  font-weight: 500;
              }
              .calendar-button:hover {
                  border-color: #667eea;
                  background: #f8f9ff;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
              }
              .calendar-icon {
                  width: 32px;
                  height: 32px;
                  border-radius: 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: 14px;
              }
              .google-icon { background: #4285f4; }
              .outlook-icon { background: #0078d4; }
              .apple-icon { background: #000; }
              .ical-icon { background: #666; }
              .events-section {
                  background: white;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  overflow: hidden;
              }
              .events-header {
                  background: #f8f9fa;
                  padding: 1.5rem;
                  border-bottom: 1px solid #dee2e6;
              }
              .events-header h2 {
                  margin: 0;
                  color: #333;
              }
              .events-list {
                  padding: 0;
              }
              .event-item {
                  padding: 1.5rem;
                  border-bottom: 1px solid #f0f0f0;
                  transition: background-color 0.3s;
              }
              .event-item:hover {
                  background: #f8f9ff;
              }
              .event-item:last-child {
                  border-bottom: none;
              }
              .event-title {
                  font-size: 1.2rem;
                  font-weight: 600;
                  color: #333;
                  margin: 0 0 0.5rem 0;
              }
              .event-datetime {
                  color: #667eea;
                  font-weight: 500;
                  margin-bottom: 0.5rem;
              }
              .event-description {
                  color: #666;
                  margin: 0;
              }
              .event-location {
                  color: #888;
                  font-size: 0.9rem;
                  margin-top: 0.5rem;
              }
              .no-events {
                  text-align: center;
                  padding: 3rem;
                  color: #666;
              }
              .no-events h3 {
                  margin: 0 0 1rem 0;
                  color: #999;
              }
              @media (max-width: 768px) {
                  .header h1 {
                      font-size: 2rem;
                  }
                  .main-content {
                      padding: 1rem;
                  }
                  .calendar-buttons {
                      grid-template-columns: 1fr;
                  }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>${company.name}</h1>
              <p>Public Calendar</p>
          </div>
          
          <div class="main-content">
              <div class="subscription-section">
                  <h2>📅 Subscribe to Our Calendar</h2>
                  <p>Add our calendar to your favorite calendar app to receive automatic updates when events change.</p>
                  
                  <div class="calendar-buttons">
                      <a href="${calendarUrls.googleCalendar}" target="_blank" class="calendar-button">
                          <div class="calendar-icon google-icon">G</div>
                          <span>Add to Google Calendar</span>
                      </a>
                      <a href="${calendarUrls.outlookCalendar}" target="_blank" class="calendar-button">
                          <div class="calendar-icon outlook-icon">O</div>
                          <span>Add to Outlook</span>
                      </a>
                      <a href="${calendarUrls.appleCalendar}" class="calendar-button">
                          <div class="calendar-icon apple-icon">🍎</div>
                          <span>Add to Apple Calendar</span>
                      </a>
                      <a href="${calendarUrls.icalFeed}" target="_blank" class="calendar-button">
                          <div class="calendar-icon ical-icon">📅</div>
                          <span>Download iCal Feed</span>
                      </a>
                  </div>
              </div>
              
              <div class="events-section">
                  <div class="events-header">
                      <h2>Upcoming Events</h2>
                  </div>
                  <div class="events-list">
                      ${events.length > 0 ? events.map(event => `
                          <div class="event-item">
                              <div class="event-title">${this.escapeHtml(event.title)}</div>
                              <div class="event-datetime">
                                  📅 ${this.formatEventDateTime(event.startDateTime, event.endDateTime)}
                              </div>
                              <div class="event-description">${this.escapeHtml(event.description)}</div>
                              ${event.location ? `<div class="event-location">📍 ${this.escapeHtml(event.location)}</div>` : ''}
                          </div>
                      `).join('') : `
                          <div class="no-events">
                              <h3>No upcoming events</h3>
                              <p>Check back later for new events!</p>
                          </div>
                      `}
                  </div>
              </div>
          </div>
      </body>
      </html>
      `;

      res.send(publicCalendarHtml);
    } catch (error) {
      console.error('Get public calendar view error:', error);
      return res.status(500).send('Internal server error');
    }
  }

  /**
   * Invalidate cache for the user's company
   */
  private async invalidateCache(req: Request, res: Response) {
    try {
      const user = req.user!;
      cacheService.invalidateCompanyCache(user.companyId);

      return res.json({
        success: true,
        message: 'Cache invalidated successfully'
      });
    } catch (error) {
      console.error('Invalidate cache error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache'
      });
    }
  }

  /**
   * Static method to invalidate cache from external services
   */
  static invalidateCacheForCompany(companyId: string): void {
    cacheService.invalidateCompanyCache(companyId);
  }

  /**
   * Format event date and time for display
   */
  private formatEventDateTime(startDate: Date, endDate: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };

    const start = startDate.toLocaleDateString('en-US', options);
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // If same day, show start date and end time
    if (startDate.toDateString() === endDate.toDateString()) {
      return `${start} - ${endTime}`;
    }

    // Different days, show full date range
    const end = endDate.toLocaleDateString('en-US', options);
    return `${start} - ${end}`;
  }

  /**
   * Escape HTML characters for safe display
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getRouter(): Router {
    return this.router;
  }
}

export const calendarRoutes = new CalendarRoutes();