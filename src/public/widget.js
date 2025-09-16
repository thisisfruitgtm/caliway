/**
 * Calendar Widget Library
 * A lightweight JavaScript library for embedding company calendar widgets
 */
(function(window, document) {
  'use strict';

  // Widget configuration defaults
  const DEFAULT_CONFIG = {
    theme: 'light',
    primaryColor: '#007bff',
    showUpcomingOnly: true,
    maxEvents: 10,
    dateFormat: 'MMM dd, yyyy'
  };

  // Widget class
  function CalendarWidget(options) {
    this.options = Object.assign({}, DEFAULT_CONFIG, options);
    this.containerId = options.containerId || 'calendar-widget';
    this.companyId = options.companyId;
    this.apiUrl = options.apiUrl || 'http://caliway.thisisfruit.com';
    this.events = [];
    this.container = null;
    
    if (!this.companyId) {
      throw new Error('companyId is required');
    }
    
    this.init();
  }

  CalendarWidget.prototype.init = function() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error('Widget container not found:', this.containerId);
      return;
    }
    
    this.setupStyles();
    this.loadEvents();
  };

  CalendarWidget.prototype.setupStyles = function() {
    // Apply base styles to container
    const styles = {
      fontFamily: 'Arial, sans-serif',
      maxWidth: '400px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: this.options.theme === 'dark' ? '#333' : '#fff',
      color: this.options.theme === 'dark' ? '#fff' : '#333',
      boxSizing: 'border-box'
    };
    
    Object.assign(this.container.style, styles);
  };

  CalendarWidget.prototype.loadEvents = function() {
    const self = this;
    
    // Show loading state
    this.container.innerHTML = '<p>Loading events...</p>';
    
    // Fetch events from API
    fetch(this.apiUrl + '/api/widget/' + this.companyId + '/events')
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load events');
        }
        return response.json();
      })
      .then(function(events) {
        self.events = events;
        self.render();
      })
      .catch(function(error) {
        console.error('Failed to load widget events:', error);
        self.container.innerHTML = '<p>Failed to load events</p>';
      });
  };

  CalendarWidget.prototype.render = function() {
    if (this.events.length === 0) {
      this.container.innerHTML = '<p>No upcoming events</p>';
      return;
    }
    
    // Create header
    const header = document.createElement('h3');
    header.textContent = 'Upcoming Events';
    header.style.marginTop = '0';
    header.style.color = this.options.primaryColor;
    header.style.fontSize = '18px';
    header.style.marginBottom = '16px';
    
    // Create events container
    const eventsContainer = document.createElement('div');
    eventsContainer.style.display = 'flex';
    eventsContainer.style.flexDirection = 'column';
    eventsContainer.style.gap = '12px';
    
    // Create event elements
    for (let i = 0; i < this.events.length; i++) {
      const eventElement = this.createEventElement(this.events[i]);
      eventsContainer.appendChild(eventElement);
    }
    
    // Clear container and add content
    this.container.innerHTML = '';
    this.container.appendChild(header);
    this.container.appendChild(eventsContainer);
  };

  CalendarWidget.prototype.createEventElement = function(event) {
    const self = this;
    const eventDiv = document.createElement('div');
    
    // Event container styles
    const eventStyles = {
      padding: '12px',
      border: '1px solid #eee',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      backgroundColor: 'transparent'
    };
    
    Object.assign(eventDiv.style, eventStyles);
    
    // Format date
    const date = new Date(event.startDateTime);
    const formattedDate = this.formatDate(date);
    const formattedTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Create event content
    const title = document.createElement('div');
    title.textContent = event.title;
    title.style.fontWeight = 'bold';
    title.style.color = this.options.primaryColor;
    title.style.marginBottom = '4px';
    
    const dateTime = document.createElement('div');
    dateTime.textContent = formattedDate + ' at ' + formattedTime;
    dateTime.style.fontSize = '14px';
    dateTime.style.color = '#666';
    dateTime.style.marginBottom = '4px';
    
    const description = document.createElement('div');
    description.textContent = event.description;
    description.style.fontSize = '14px';
    description.style.overflow = 'hidden';
    description.style.textOverflow = 'ellipsis';
    description.style.whiteSpace = 'nowrap';
    
    eventDiv.appendChild(title);
    eventDiv.appendChild(dateTime);
    eventDiv.appendChild(description);
    
    // Add hover effects
    eventDiv.addEventListener('mouseenter', function() {
      eventDiv.style.backgroundColor = self.options.theme === 'dark' ? '#444' : '#f5f5f5';
    });
    
    eventDiv.addEventListener('mouseleave', function() {
      eventDiv.style.backgroundColor = 'transparent';
    });
    
    // Add click handler for modal
    eventDiv.addEventListener('click', function() {
      self.showEventModal(event);
    });
    
    return eventDiv;
  };

  CalendarWidget.prototype.formatDate = function(date) {
    const options = {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
  };

  CalendarWidget.prototype.showEventModal = function(event) {
    const self = this;
    
    // Create modal overlay
    const modal = document.createElement('div');
    const modalStyles = {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000'
    };
    
    Object.assign(modal.style, modalStyles);
    
    // Create modal content
    const modalContent = document.createElement('div');
    const contentStyles = {
      backgroundColor: this.options.theme === 'dark' ? '#333' : '#fff',
      color: this.options.theme === 'dark' ? '#fff' : '#333',
      padding: '24px',
      borderRadius: '8px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80%',
      overflow: 'auto',
      boxSizing: 'border-box'
    };
    
    Object.assign(modalContent.style, contentStyles);
    
    // Format event details
    const date = new Date(event.startDateTime);
    const formattedDate = this.formatDate(date);
    const formattedTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Create modal header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '16px';
    
    const title = document.createElement('h2');
    title.textContent = event.title;
    title.style.margin = '0';
    title.style.color = this.options.primaryColor;
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#999';
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create event details
    const details = document.createElement('div');
    details.style.marginBottom = '16px';
    details.innerHTML = 
      '<strong>Date:</strong> ' + formattedDate + '<br>' +
      '<strong>Time:</strong> ' + formattedTime + '<br>' +
      (event.location ? '<strong>Location:</strong> ' + event.location + '<br>' : '');
    
    // Create description
    const descriptionContainer = document.createElement('div');
    descriptionContainer.style.marginBottom = '24px';
    descriptionContainer.innerHTML = '<strong>Description:</strong><br>' + event.description;
    
    // Create calendar integration buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.flexWrap = 'wrap';
    
    const googleButton = this.createCalendarButton('Add to Google Calendar', '#4285f4', function() {
      self.addToGoogleCalendar(event);
    });
    
    const outlookButton = this.createCalendarButton('Add to Outlook', '#0078d4', function() {
      self.addToOutlookCalendar(event);
    });
    
    const appleButton = this.createCalendarButton('Add to Apple Calendar', '#000', function() {
      self.addToAppleCalendar(event);
    });
    
    buttonsContainer.appendChild(googleButton);
    buttonsContainer.appendChild(outlookButton);
    buttonsContainer.appendChild(appleButton);
    
    // Assemble modal content
    modalContent.appendChild(header);
    modalContent.appendChild(details);
    modalContent.appendChild(descriptionContainer);
    modalContent.appendChild(buttonsContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
    closeButton.addEventListener('click', function() {
      document.body.removeChild(modal);
    });
    
    // Close on escape key
    const escapeHandler = function(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    
    document.addEventListener('keydown', escapeHandler);
  };

  CalendarWidget.prototype.createCalendarButton = function(text, backgroundColor, clickHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    
    const buttonStyles = {
      padding: '8px 16px',
      background: backgroundColor,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'opacity 0.2s'
    };
    
    Object.assign(button.style, buttonStyles);
    
    button.addEventListener('click', clickHandler);
    
    button.addEventListener('mouseenter', function() {
      button.style.opacity = '0.8';
    });
    
    button.addEventListener('mouseleave', function() {
      button.style.opacity = '1';
    });
    
    return button;
  };

  CalendarWidget.prototype.addToGoogleCalendar = function(event) {
    const startDate = new Date(event.startDateTime);
    const endDate = new Date(event.endDateTime);
    
    const formatDateForGoogle = function(date) {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: formatDateForGoogle(startDate) + '/' + formatDateForGoogle(endDate),
      details: event.description,
      location: event.location || ''
    });
    
    const url = 'https://calendar.google.com/calendar/render?' + params.toString();
    window.open(url, '_blank');
  };

  CalendarWidget.prototype.addToOutlookCalendar = function(event) {
    const startDate = new Date(event.startDateTime);
    const endDate = new Date(event.endDateTime);
    
    const params = new URLSearchParams({
      subject: event.title,
      startdt: startDate.toISOString(),
      enddt: endDate.toISOString(),
      body: event.description,
      location: event.location || ''
    });
    
    const url = 'https://outlook.live.com/calendar/0/deeplink/compose?' + params.toString();
    window.open(url, '_blank');
  };

  CalendarWidget.prototype.addToAppleCalendar = function(event) {
    // Generate ICS content
    const startDate = new Date(event.startDateTime);
    const endDate = new Date(event.endDateTime);
    
    const formatDateForICS = function(date) {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Calendar Widget//EN',
      'BEGIN:VEVENT',
      'UID:' + event.id + '@calendar-widget',
      'DTSTAMP:' + formatDateForICS(new Date()),
      'DTSTART:' + formatDateForICS(startDate),
      'DTEND:' + formatDateForICS(endDate),
      'SUMMARY:' + event.title,
      'DESCRIPTION:' + event.description.replace(/\n/g, '\\n'),
      'LOCATION:' + (event.location || ''),
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Refresh widget data
  CalendarWidget.prototype.refresh = function() {
    this.loadEvents();
  };

  // Update widget configuration
  CalendarWidget.prototype.updateConfig = function(newConfig) {
    this.options = Object.assign(this.options, newConfig);
    this.setupStyles();
    this.render();
  };

  // Destroy widget
  CalendarWidget.prototype.destroy = function() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.cssText = '';
    }
  };

  // Auto-initialization for simple usage
  function autoInit() {
    const scripts = document.getElementsByTagName('script');
    const currentScript = scripts[scripts.length - 1];
    
    if (currentScript && currentScript.dataset.companyId) {
      const options = {
        companyId: currentScript.dataset.companyId,
        containerId: currentScript.dataset.containerId || 'calendar-widget',
        apiUrl: currentScript.dataset.apiUrl,
        theme: currentScript.dataset.theme,
        primaryColor: currentScript.dataset.primaryColor,
        showUpcomingOnly: currentScript.dataset.showUpcomingOnly === 'true',
        maxEvents: parseInt(currentScript.dataset.maxEvents) || undefined
      };
      
      // Remove undefined values
      Object.keys(options).forEach(key => {
        if (options[key] === undefined) {
          delete options[key];
        }
      });
      
      // Initialize when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          new CalendarWidget(options);
        });
      } else {
        new CalendarWidget(options);
      }
    }
  }

  // Expose CalendarWidget to global scope
  window.CalendarWidget = CalendarWidget;
  
  // Auto-initialize if script has data attributes
  autoInit();

})(window, document);