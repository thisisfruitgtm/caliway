import { Event, WidgetConfig } from '../models';
import { IEventRepository } from '../repositories/EventRepository';
import { ICompanyRepository } from '../repositories/CompanyRepository';
import { IWidgetConfigRepository } from '../repositories/WidgetConfigRepository';

export interface IWidgetApiService {
  getWidgetEvents(companyId: string): Promise<Event[]>;
  getWidgetConfig(companyId: string): Promise<WidgetConfig>;
  updateWidgetConfig(companyId: string, config: Partial<WidgetConfig>): Promise<WidgetConfig>;
  generateWidgetScript(companyId: string): Promise<string>;
}

export class WidgetApiService implements IWidgetApiService {
  constructor(
    private eventRepository: IEventRepository,
    private companyRepository: ICompanyRepository,
    private widgetConfigRepository: IWidgetConfigRepository
  ) {}

  async getWidgetEvents(companyId: string): Promise<Event[]> {
    try {
      // Verify company exists
      const company = await this.companyRepository.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Get widget configuration to determine filtering
      const config = await this.getWidgetConfig(companyId);
      
      // Get all public events for the company
      const allEvents = await this.eventRepository.findByCompanyId(companyId);
      let filteredEvents = allEvents.filter(event => event.isPublic);

      // Apply upcoming only filter if configured
      if (config.showUpcomingOnly) {
        const now = new Date();
        filteredEvents = filteredEvents.filter(event => event.startDateTime > now);
      }

      // Sort by start date
      filteredEvents.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());

      // Apply max events limit
      if (config.maxEvents > 0) {
        filteredEvents = filteredEvents.slice(0, config.maxEvents);
      }

      return filteredEvents;
    } catch (error) {
      console.error('Error getting widget events:', error);
      throw new Error('Failed to retrieve widget events');
    }
  }

  async getWidgetConfig(companyId: string): Promise<WidgetConfig> {
    try {
      // Verify company exists
      const company = await this.companyRepository.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Try to get existing config
      let config = await this.widgetConfigRepository.findByCompanyId(companyId);
      
      // If no config exists, create default one
      if (!config) {
        const defaultConfig: WidgetConfig = {
          companyId,
          theme: 'light',
          primaryColor: '#007bff',
          showUpcomingOnly: true,
          maxEvents: 10,
          dateFormat: 'MMM DD, YYYY'
        };
        
        config = await this.widgetConfigRepository.create(defaultConfig);
      }

      return config;
    } catch (error) {
      console.error('Error getting widget config:', error);
      throw new Error('Failed to retrieve widget configuration');
    }
  }

  async updateWidgetConfig(companyId: string, configUpdate: Partial<WidgetConfig>): Promise<WidgetConfig> {
    try {
      // Verify company exists
      const company = await this.companyRepository.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Validate configuration values
      this.validateConfigUpdate(configUpdate);

      // Get current config to ensure it exists
      await this.getWidgetConfig(companyId);

      // Update the configuration
      const updatedConfig = await this.widgetConfigRepository.update(companyId, configUpdate);
      
      if (!updatedConfig) {
        throw new Error('Failed to update widget configuration');
      }

      return updatedConfig;
    } catch (error) {
      console.error('Error updating widget config:', error);
      // Re-throw validation errors with original message
      if (error instanceof Error && (
        error.message.includes('Invalid theme value') ||
        error.message.includes('Invalid primary color') ||
        error.message.includes('Max events must be') ||
        error.message.includes('Date format must be')
      )) {
        throw error;
      }
      throw new Error('Failed to update widget configuration');
    }
  }

  async generateWidgetScript(companyId: string): Promise<string> {
    try {
      // Verify company exists
      const company = await this.companyRepository.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Get widget configuration
      const config = await this.getWidgetConfig(companyId);

      // Generate the widget script with configuration
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      
      const script = `
(function() {
  // Widget configuration
  const config = ${JSON.stringify(config, null, 2)};
  const apiUrl = '${baseUrl}/api/widget/${companyId}';
  
  // Create widget container
  function createWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Widget container not found:', containerId);
      return;
    }
    
    // Set container styles
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.maxWidth = '400px';
    container.style.border = '1px solid #ddd';
    container.style.borderRadius = '8px';
    container.style.padding = '16px';
    container.style.backgroundColor = config.theme === 'dark' ? '#333' : '#fff';
    container.style.color = config.theme === 'dark' ? '#fff' : '#333';
    
    // Load events and render
    loadEvents(container);
  }
  
  // Load events from API
  async function loadEvents(container) {
    try {
      const response = await fetch(apiUrl + '/events');
      const events = await response.json();
      
      renderEvents(container, events);
    } catch (error) {
      console.error('Failed to load widget events:', error);
      container.innerHTML = '<p>Failed to load events</p>';
    }
  }
  
  // Render events in container
  function renderEvents(container, events) {
    if (events.length === 0) {
      container.innerHTML = '<p>No upcoming events</p>';
      return;
    }
    
    const eventsList = document.createElement('div');
    eventsList.style.display = 'flex';
    eventsList.style.flexDirection = 'column';
    eventsList.style.gap = '12px';
    
    events.forEach(event => {
      const eventElement = createEventElement(event);
      eventsList.appendChild(eventElement);
    });
    
    container.innerHTML = '<h3 style="margin-top: 0; color: ' + config.primaryColor + ';">Upcoming Events</h3>';
    container.appendChild(eventsList);
  }
  
  // Create individual event element
  function createEventElement(event) {
    const eventDiv = document.createElement('div');
    eventDiv.style.padding = '12px';
    eventDiv.style.border = '1px solid #eee';
    eventDiv.style.borderRadius = '4px';
    eventDiv.style.cursor = 'pointer';
    eventDiv.style.transition = 'background-color 0.2s';
    
    const date = new Date(event.startDateTime);
    const formattedDate = formatDate(date, config.dateFormat);
    
    eventDiv.innerHTML = \`
      <div style="font-weight: bold; color: \${config.primaryColor}; margin-bottom: 4px;">\${event.title}</div>
      <div style="font-size: 14px; color: #666; margin-bottom: 4px;">\${formattedDate}</div>
      <div style="font-size: 14px;">\${event.description}</div>
    \`;
    
    // Add hover effect
    eventDiv.addEventListener('mouseenter', () => {
      eventDiv.style.backgroundColor = config.theme === 'dark' ? '#444' : '#f5f5f5';
    });
    
    eventDiv.addEventListener('mouseleave', () => {
      eventDiv.style.backgroundColor = 'transparent';
    });
    
    // Add click handler for modal
    eventDiv.addEventListener('click', () => {
      showEventModal(event);
    });
    
    return eventDiv;
  }
  
  // Format date according to configuration
  function formatDate(date, format) {
    const options = {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
  }
  
  // Show event modal with calendar integration
  function showEventModal(event) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = config.theme === 'dark' ? '#333' : '#fff';
    modalContent.style.color = config.theme === 'dark' ? '#fff' : '#333';
    modalContent.style.padding = '24px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '500px';
    modalContent.style.width = '90%';
    modalContent.style.maxHeight = '80%';
    modalContent.style.overflow = 'auto';
    
    const date = new Date(event.startDateTime);
    const formattedDate = formatDate(date, config.dateFormat);
    const formattedTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    modalContent.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0; color: \${config.primaryColor};">\${event.title}</h2>
        <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
      </div>
      <div style="margin-bottom: 16px;">
        <strong>Date:</strong> \${formattedDate}<br>
        <strong>Time:</strong> \${formattedTime}
        \${event.location ? \`<br><strong>Location:</strong> \${event.location}\` : ''}
      </div>
      <div style="margin-bottom: 24px;">
        <strong>Description:</strong><br>
        \${event.description}
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button onclick="addToGoogleCalendar('\${event.id}')" style="padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Add to Google Calendar</button>
        <button onclick="addToOutlookCalendar('\${event.id}')" style="padding: 8px 16px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">Add to Outlook</button>
        <button onclick="addToAppleCalendar('\${event.id}')" style="padding: 8px 16px; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer;">Add to Apple Calendar</button>
      </div>
    \`;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
    modalContent.querySelector('#closeModal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }
  
  // Calendar integration functions
  window.addToGoogleCalendar = function(eventId) {
    const url = \`\${apiUrl}/calendar-urls/\${eventId}/google\`;
    window.open(url, '_blank');
  };
  
  window.addToOutlookCalendar = function(eventId) {
    const url = \`\${apiUrl}/calendar-urls/\${eventId}/outlook\`;
    window.open(url, '_blank');
  };
  
  window.addToAppleCalendar = function(eventId) {
    const url = \`\${apiUrl}/calendar-urls/\${eventId}/apple\`;
    window.open(url, '_blank');
  };
  
  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createWidget('calendar-widget');
    });
  } else {
    createWidget('calendar-widget');
  }
})();`.trim();

      return script;
    } catch (error) {
      console.error('Error generating widget script:', error);
      throw new Error('Failed to generate widget script');
    }
  }

  private validateConfigUpdate(config: Partial<WidgetConfig>): void {
    if (config.theme && !['light', 'dark', 'auto'].includes(config.theme)) {
      throw new Error('Invalid theme value. Must be light, dark, or auto');
    }

    if (config.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.primaryColor)) {
      throw new Error('Invalid primary color. Must be a valid hex color code');
    }

    if (config.maxEvents !== undefined && (config.maxEvents < 0 || config.maxEvents > 100)) {
      throw new Error('Max events must be between 0 and 100');
    }

    if (config.dateFormat && typeof config.dateFormat !== 'string') {
      throw new Error('Date format must be a string');
    }
  }
}