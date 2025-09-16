import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock fetch globally
global.fetch = vi.fn();

describe('CalendarWidget', () => {
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let document: Document;
  let CalendarWidget: any;
  let mockEvents: any[];

  beforeEach(() => {
    // Create JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window as any;
    document = window.document;
    
    // Set up global objects
    global.window = window as any;
    global.document = document;
    global.URL = window.URL;
    global.Blob = window.Blob;
    
    // Set up fetch in the window object
    window.fetch = global.fetch;
    
    // Reset fetch mock
    vi.mocked(fetch).mockClear();
    
    // Load and execute widget script
    const widgetScript = fs.readFileSync(path.join(__dirname, '../widget.js'), 'utf8');
    const scriptFunction = new Function('window', 'document', widgetScript);
    scriptFunction(window, document);
    
    CalendarWidget = window.CalendarWidget;
    
    // Mock events data
    mockEvents = [
      {
        id: 'event-1',
        title: 'Test Event 1',
        description: 'Description for test event 1',
        startDateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endDateTime: new Date(Date.now() + 90000000).toISOString(),
        location: 'Test Location',
        isPublic: true
      },
      {
        id: 'event-2',
        title: 'Test Event 2',
        description: 'Description for test event 2',
        startDateTime: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        endDateTime: new Date(Date.now() + 176400000).toISOString(),
        isPublic: true
      }
    ];
    
    // Create container element
    const container = document.createElement('div');
    container.id = 'calendar-widget';
    document.body.appendChild(container);
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should throw error when companyId is not provided', () => {
      expect(() => {
        new CalendarWidget({});
      }).toThrow('companyId is required');
    });

    it('should initialize with default configuration', () => {
      const widget = new CalendarWidget({
        companyId: 'test-company'
      });

      expect(widget.companyId).toBe('test-company');
      expect(widget.containerId).toBe('calendar-widget');
      expect(widget.apiUrl).toBe('http://localhost:3000');
      expect(widget.options.theme).toBe('light');
      expect(widget.options.primaryColor).toBe('#007bff');
    });

    it('should override default configuration with provided options', () => {
      const widget = new CalendarWidget({
        companyId: 'test-company',
        containerId: 'custom-container',
        apiUrl: 'https://example.com',
        theme: 'dark',
        primaryColor: '#ff0000'
      });

      expect(widget.containerId).toBe('custom-container');
      expect(widget.apiUrl).toBe('https://example.com');
      expect(widget.options.theme).toBe('dark');
      expect(widget.options.primaryColor).toBe('#ff0000');
    });

    it('should apply styles to container', () => {
      const widget = new CalendarWidget({
        companyId: 'test-company'
      });

      const container = document.getElementById('calendar-widget');
      expect(container?.style.fontFamily).toBe('Arial, sans-serif');
      expect(container?.style.maxWidth).toBe('400px');
      expect(container?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });

    it('should apply dark theme styles', () => {
      const widget = new CalendarWidget({
        companyId: 'test-company',
        theme: 'dark'
      });

      const container = document.getElementById('calendar-widget');
      expect(container?.style.backgroundColor).toBe('rgb(51, 51, 51)');
      expect(container?.style.color).toBe('rgb(255, 255, 255)');
    });
  });

  describe('Event Loading', () => {
    it('should fetch events from API on initialization', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      } as Response);

      new CalendarWidget({
        companyId: 'test-company'
      });

      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/widget/test-company/events');
    });

    it('should display loading state initially', () => {
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {})); // Never resolves

      new CalendarWidget({
        companyId: 'test-company'
      });

      const container = document.getElementById('calendar-widget');
      expect(container?.innerHTML).toContain('Loading events...');
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('API Error'));

      new CalendarWidget({
        companyId: 'test-company'
      });

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      const container = document.getElementById('calendar-widget');
      expect(container?.innerHTML).toContain('Failed to load events');
    });

    it('should handle non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      new CalendarWidget({
        companyId: 'test-company'
      });

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      const container = document.getElementById('calendar-widget');
      expect(container?.innerHTML).toContain('Failed to load events');
    });
  });

  describe('Event Rendering', () => {
    let widget: any;

    beforeEach(async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      } as Response);

      widget = new CalendarWidget({
        companyId: 'test-company'
      });

      // Wait for events to load
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should render events after loading', () => {
      const container = document.getElementById('calendar-widget');
      expect(container?.innerHTML).toContain('Upcoming Events');
      expect(container?.innerHTML).toContain('Test Event 1');
      expect(container?.innerHTML).toContain('Test Event 2');
    });

    it('should display "No upcoming events" when no events', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      } as Response);

      const widget = new CalendarWidget({
        companyId: 'test-company'
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const container = document.getElementById('calendar-widget');
      expect(container?.innerHTML).toContain('No upcoming events');
    });

    it('should format dates correctly', () => {
      const container = document.getElementById('calendar-widget');
      const eventElements = container?.querySelectorAll('[style*="cursor: pointer"]');
      
      expect(eventElements?.length).toBe(2);
      // Check that date formatting is present (should contain month abbreviation)
      expect(container?.innerHTML).toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
    });

    it('should apply primary color to title and header', () => {
      const container = document.getElementById('calendar-widget');
      const header = container?.querySelector('h3') as HTMLElement;
      
      expect(header?.style.color).toBe('rgb(0, 123, 255)'); // #007bff
    });
  });

  describe('Widget Methods', () => {
    let widget: any;

    beforeEach(async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      } as Response);

      widget = new CalendarWidget({
        companyId: 'test-company'
      });

      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should refresh widget data', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      } as Response);

      widget.refresh();
      
      expect(fetch).toHaveBeenCalledTimes(2); // Initial load + refresh
    });

    it('should update configuration', () => {
      const container = document.getElementById('calendar-widget');
      
      widget.updateConfig({
        theme: 'dark',
        primaryColor: '#ff0000'
      });
      
      expect(widget.options.theme).toBe('dark');
      expect(widget.options.primaryColor).toBe('#ff0000');
      expect(container?.style.backgroundColor).toBe('rgb(51, 51, 51)'); // #333
    });

    it('should destroy widget', () => {
      const container = document.getElementById('calendar-widget');
      
      widget.destroy();
      
      expect(container?.innerHTML).toBe('');
      expect(container?.style.cssText).toBe('');
    });
  });

  describe('Calendar Integration', () => {
    let widget: any;
    let originalOpen: any;

    beforeEach(async () => {
      // Mock window.open
      originalOpen = window.open;
      window.open = vi.fn();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      } as Response);

      widget = new CalendarWidget({
        companyId: 'test-company'
      });

      await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('should generate Google Calendar URL', () => {
      widget.addToGoogleCalendar(mockEvents[0]);
      
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://calendar.google.com/calendar/render?'),
        '_blank'
      );
      
      const calledUrl = vi.mocked(window.open).mock.calls[0][0];
      expect(calledUrl).toContain('text=Test%20Event%201');
      expect(calledUrl).toContain('details=Description%20for%20test%20event%201');
    });

    it('should generate Outlook Calendar URL', () => {
      widget.addToOutlookCalendar(mockEvents[0]);
      
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://outlook.live.com/calendar/0/deeplink/compose?'),
        '_blank'
      );
      
      const calledUrl = vi.mocked(window.open).mock.calls[0][0];
      expect(calledUrl).toContain('subject=Test%20Event%201');
      expect(calledUrl).toContain('body=Description%20for%20test%20event%201');
    });

    it('should generate ICS file for Apple Calendar', () => {
      // Mock URL.createObjectURL and URL.revokeObjectURL
      const mockUrl = 'blob:mock-url';
      window.URL.createObjectURL = vi.fn(() => mockUrl);
      window.URL.revokeObjectURL = vi.fn();

      widget.addToAppleCalendar(mockEvents[0]);
      
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
      
      // Check that a download link was created and clicked
      const blob = vi.mocked(window.URL.createObjectURL).mock.calls[0][0];
      expect(blob.type).toBe('text/calendar');
    });
  });
});