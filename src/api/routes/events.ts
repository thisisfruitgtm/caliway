import { Router, Request, Response } from 'express';
import { EventManagementService, UpdateEventData } from '../../services/EventManagementService';
import { EventRepository } from '../../repositories/EventRepository';
import { Event } from '../../models/Event';
import { authMiddleware } from '../middleware/auth';

export interface CreateEventRequest {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  isPublic?: boolean;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  isPublic?: boolean;
}

export interface EventResponse {
  success: boolean;
  event?: any;
  events?: any[];
  error?: string;
  errors?: string[];
}

export class EventRoutes {
  private router: Router;
  private eventService: EventManagementService;

  constructor() {
    this.router = Router();
    const eventRepository = new EventRepository();
    this.eventService = new EventManagementService(eventRepository);
    this.setupRoutes();
  }

  private setupRoutes() {
    // Event management page (GET)
    this.router.get('/events',
      authMiddleware.requireAuth({ redirectUrl: '/login' }),
      this.renderEventsPage.bind(this)
    );

    // API Routes - all require authentication
    this.router.get('/api/events',
      authMiddleware.requireAuth({ returnJson: true }),
      this.getEvents.bind(this)
    );

    this.router.post('/api/events',
      authMiddleware.requireAuth({ returnJson: true }),
      this.createEvent.bind(this)
    );

    this.router.get('/api/events/:id',
      authMiddleware.requireAuth({ returnJson: true }),
      this.getEvent.bind(this)
    );

    this.router.put('/api/events/:id',
      authMiddleware.requireAuth({ returnJson: true }),
      this.updateEvent.bind(this)
    );

    this.router.delete('/api/events/:id',
      authMiddleware.requireAuth({ returnJson: true }),
      this.deleteEvent.bind(this)
    );
  }

  /**
   * Render events management page
   */
  private renderEventsPage(req: Request, res: Response) {
    const user = req.user!;

    const eventsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Company Calendar - Manage Events</title>
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
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
            }
            .page-header h2 {
                margin: 0;
                color: #333;
            }
            .create-button {
                background: #28a745;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
            }
            .create-button:hover {
                background: #218838;
            }
            .events-container {
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .events-header {
                background: #f8f9fa;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid #dee2e6;
                font-weight: 600;
                color: #333;
            }
            .events-list {
                min-height: 200px;
            }
            .event-item {
                padding: 1.5rem;
                border-bottom: 1px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }
            .event-item:last-child {
                border-bottom: none;
            }
            .event-info {
                flex: 1;
            }
            .event-title {
                font-size: 1.1rem;
                font-weight: 600;
                color: #333;
                margin: 0 0 0.5rem 0;
            }
            .event-description {
                color: #666;
                margin: 0 0 0.5rem 0;
            }
            .event-datetime {
                color: #667eea;
                font-size: 0.9rem;
                font-weight: 500;
            }
            .event-location {
                color: #666;
                font-size: 0.9rem;
                margin-top: 0.25rem;
            }
            .event-actions {
                display: flex;
                gap: 0.5rem;
            }
            .edit-button, .delete-button {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 0.9rem;
            }
            .edit-button {
                background: #667eea;
                color: white;
            }
            .edit-button:hover {
                background: #5a6fd8;
            }
            .delete-button {
                background: #dc3545;
                color: white;
            }
            .delete-button:hover {
                background: #c82333;
            }
            .empty-state {
                text-align: center;
                padding: 3rem;
                color: #666;
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
            
            /* Modal Styles */
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 10px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }
            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h3 {
                margin: 0;
                color: #333;
            }
            .close-button {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #666;
            }
            .close-button:hover {
                color: #333;
            }
            .modal-body {
                padding: 1.5rem;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                color: #333;
                font-weight: 500;
            }
            .form-group input, .form-group textarea {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e1e5e9;
                border-radius: 5px;
                font-size: 1rem;
                box-sizing: border-box;
            }
            .form-group input:focus, .form-group textarea:focus {
                outline: none;
                border-color: #667eea;
            }
            .form-group textarea {
                resize: vertical;
                min-height: 100px;
            }
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
            }
            
            /* View Toggle Styles */
            .view-toggle {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 2rem;
                background: #f8f9fa;
                padding: 0.5rem;
                border-radius: 8px;
                width: fit-content;
            }
            .view-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                border: none;
                border-radius: 6px;
                background: transparent;
                color: #666;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 0.9rem;
                font-weight: 500;
            }
            .view-btn:hover {
                background: #e9ecef;
                color: #333;
            }
            .view-btn.active {
                background: #667eea;
                color: white;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
            }
            .view-icon {
                width: 18px;
                height: 18px;
            }
            
            /* Calendar View Styles */
            .calendar-container {
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .calendar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                background: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
            }
            .calendar-nav {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .nav-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 8px;
                background: white;
                color: #666;
                cursor: pointer;
                transition: all 0.3s;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .nav-btn:hover {
                background: #667eea;
                color: white;
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
            }
            .nav-icon {
                width: 20px;
                height: 20px;
            }
            .calendar-title {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #333;
                min-width: 200px;
                text-align: center;
            }
            .today-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                background: #667eea;
                color: white;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s;
            }
            .today-btn:hover {
                background: #5a6fd8;
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
            }
            
            /* Calendar Grid */
            .calendar-days-header {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                background: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
            }
            .day-header {
                padding: 1rem;
                text-align: center;
                font-weight: 600;
                color: #666;
                font-size: 0.9rem;
            }
            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 1px;
                background: #e9ecef;
            }
            .calendar-day {
                background: white;
                min-height: 120px;
                padding: 0.75rem;
                position: relative;
                cursor: pointer;
                transition: all 0.3s;
                border: 2px solid transparent;
            }
            .calendar-day:hover {
                background: #f8f9ff;
                border-color: #667eea;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
            }
            .calendar-day.other-month {
                background: #f8f9fa;
                color: #adb5bd;
            }
            .calendar-day.other-month:hover {
                background: #f1f3f4;
            }
            .calendar-day.today {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .calendar-day.today:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            .calendar-day.today .day-number {
                color: white;
            }
            .day-number {
                font-weight: 600;
                font-size: 1rem;
                margin-bottom: 0.5rem;
                color: #333;
            }
            .calendar-day.today .day-number {
                color: white;
            }
            
            /* Event Tiles in Calendar */
            .calendar-event {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                margin-bottom: 0.25rem;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 0.25rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .calendar-event:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4c93 100%);
            }
            .calendar-event-time {
                font-weight: 600;
                opacity: 0.9;
            }
            .calendar-event-title {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Add Event Button */
            .add-event-btn {
                position: absolute;
                bottom: 0.5rem;
                right: 0.5rem;
                width: 28px;
                height: 28px;
                border: 2px solid white;
                border-radius: 50%;
                background: #667eea;
                color: white;
                cursor: pointer;
                opacity: 0;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: bold;
                box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
            }
            .calendar-day:hover .add-event-btn {
                opacity: 1;
                transform: scale(1.1);
            }
            .add-event-btn:hover {
                background: #5a6fd8;
                transform: scale(1.2) !important;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
            }
            
            /* Empty day hint */
            .calendar-day.empty-day::after {
                content: 'Click to add event';
                position: absolute;
                bottom: 0.5rem;
                left: 0.5rem;
                font-size: 0.7rem;
                color: #adb5bd;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }
            .calendar-day.empty-day:hover::after {
                opacity: 1;
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .calendar-header {
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1rem;
                }
                .calendar-nav {
                    order: 2;
                }
                .today-btn {
                    order: 1;
                }
                .calendar-title {
                    font-size: 1.25rem;
                    min-width: auto;
                }
                .calendar-day {
                    min-height: 80px;
                    padding: 0.5rem;
                }
                .day-header {
                    padding: 0.75rem 0.5rem;
                    font-size: 0.8rem;
                }
                .view-toggle {
                    width: 100%;
                    justify-content: center;
                }
            }
            .checkbox-group {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .checkbox-group input[type="checkbox"] {
                width: auto;
            }
            .modal-footer {
                padding: 1.5rem;
                border-top: 1px solid #dee2e6;
                display: flex;
                justify-content: flex-end;
                gap: 1rem;
            }
            .cancel-button {
                background: #6c757d;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
            }
            .cancel-button:hover {
                background: #5a6268;
            }
            .save-button {
                background: #28a745;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
            }
            .save-button:hover {
                background: #218838;
            }
            .save-button:disabled {
                background: #ccc;
                cursor: not-allowed;
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
                <h2>Manage Events</h2>
                <button class="create-button" onclick="openCreateModal()">Create Event</button>
            </div>
            
            <div id="error-container"></div>
            
            <!-- View Toggle -->
            <div class="view-toggle">
                <button id="list-view-btn" class="view-btn active" onclick="switchView('list')">
                    <svg class="view-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                    </svg>
                    List View
                </button>
                <button id="calendar-view-btn" class="view-btn" onclick="switchView('calendar')">
                    <svg class="view-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    Calendar View
                </button>
            </div>

            <!-- List View Container -->
            <div id="list-view" class="events-container">
                <div class="events-header">
                    Your Company Events
                </div>
                <div class="events-list" id="events-list">
                    <div class="loading">Loading events...</div>
                </div>
            </div>

            <!-- Calendar View Container -->
            <div id="calendar-view" class="calendar-container" style="display: none;">
                <div class="calendar-header">
                    <div class="calendar-nav">
                        <button id="prev-month" class="nav-btn">
                            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6"></path>
                            </svg>
                        </button>
                        <h3 id="calendar-title" class="calendar-title">December 2024</h3>
                        <button id="next-month" class="nav-btn">
                            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6"></path>
                            </svg>
                        </button>
                    </div>
                    <button id="today-btn" class="today-btn">Today</button>
                </div>
                
                <!-- Day Headers -->
                <div class="calendar-days-header">
                    <div class="day-header">Sun</div>
                    <div class="day-header">Mon</div>
                    <div class="day-header">Tue</div>
                    <div class="day-header">Wed</div>
                    <div class="day-header">Thu</div>
                    <div class="day-header">Fri</div>
                    <div class="day-header">Sat</div>
                </div>
                
                <!-- Calendar Grid -->
                <div class="calendar-grid" id="calendar-grid">
                    <!-- Calendar days will be generated by JavaScript -->
                </div>
            </div>
        </div>

        <!-- Event Modal -->
        <div id="event-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modal-title">Create Event</h3>
                    <button class="close-button" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="event-form">
                        <div class="form-group">
                            <label for="event-title">Event Title *</label>
                            <input type="text" id="event-title" name="title" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="event-description">Description *</label>
                            <textarea id="event-description" name="description" required></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="event-start">Start Date & Time *</label>
                                <input type="datetime-local" id="event-start" name="startDateTime" required>
                            </div>
                            <div class="form-group">
                                <label for="event-end">End Date & Time *</label>
                                <input type="datetime-local" id="event-end" name="endDateTime" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="event-location">Location</label>
                            <input type="text" id="event-location" name="location">
                        </div>
                        
                        <div class="form-group">
                            <div class="checkbox-group">
                                <input type="checkbox" id="event-public" name="isPublic" checked>
                                <label for="event-public">Make this event public (visible in shared calendars)</label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="cancel-button" onclick="closeModal()">Cancel</button>
                    <button class="save-button" id="save-button" onclick="saveEvent()">Save Event</button>
                </div>
            </div>
        </div>

        <script>
            let currentEventId = null;
            let events = [];

            // Load events on page load
            document.addEventListener('DOMContentLoaded', loadEvents);

            async function loadEvents() {
                try {
                    const response = await fetch('/api/events');
                    const result = await response.json();
                    
                    if (result.success) {
                        events = result.events || [];
                        renderEvents();
                        if (currentView === 'calendar') {
                            renderCalendar();
                        }
                    } else {
                        showError('Failed to load events: ' + (result.error || 'Unknown error'));
                    }
                } catch (error) {
                    showError('Network error loading events. Please refresh the page.');
                }
            }

            // Calendar state
            let currentCalendarDate = new Date();
            let currentView = 'list';

            // View switching
            function switchView(view) {
                currentView = view;
                const listView = document.getElementById('list-view');
                const calendarView = document.getElementById('calendar-view');
                const listBtn = document.getElementById('list-view-btn');
                const calendarBtn = document.getElementById('calendar-view-btn');

                if (view === 'list') {
                    listView.style.display = 'block';
                    calendarView.style.display = 'none';
                    listBtn.classList.add('active');
                    calendarBtn.classList.remove('active');
                } else {
                    listView.style.display = 'none';
                    calendarView.style.display = 'block';
                    listBtn.classList.remove('active');
                    calendarBtn.classList.add('active');
                    renderCalendar();
                }
            }

            // Calendar navigation
            function navigateCalendar(direction) {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
                renderCalendar();
            }

            function goToToday() {
                currentCalendarDate = new Date();
                renderCalendar();
            }

            // Calendar rendering
            function renderCalendar() {
                const grid = document.getElementById('calendar-grid');
                const title = document.getElementById('calendar-title');
                
                // Update title
                title.textContent = currentCalendarDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                });

                // Clear grid
                grid.innerHTML = '';

                // Get first day of month and calculate start date
                const firstDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay());

                // Generate 42 days (6 weeks)
                for (let i = 0; i < 42; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    
                    const dayElement = document.createElement('div');
                    dayElement.className = 'calendar-day';
                    
                    // Add classes for styling
                    if (date.getMonth() !== currentCalendarDate.getMonth()) {
                        dayElement.classList.add('other-month');
                    }
                    
                    if (isToday(date)) {
                        dayElement.classList.add('today');
                    }

                    // Day number
                    const dayNumber = document.createElement('div');
                    dayNumber.className = 'day-number';
                    dayNumber.textContent = date.getDate();
                    dayElement.appendChild(dayNumber);

                    // Add events for this day
                    const dayEvents = events.filter(event => {
                        const eventDate = new Date(event.startDateTime);
                        return eventDate.toDateString() === date.toDateString();
                    });

                    // Mark empty days
                    if (dayEvents.length === 0) {
                        dayElement.classList.add('empty-day');
                    }

                    dayEvents.forEach(event => {
                        const eventElement = document.createElement('div');
                        eventElement.className = 'calendar-event';
                        
                        const eventTime = document.createElement('span');
                        eventTime.className = 'calendar-event-time';
                        const startTime = new Date(event.startDateTime);
                        eventTime.textContent = startTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        });
                        
                        const eventTitle = document.createElement('span');
                        eventTitle.className = 'calendar-event-title';
                        eventTitle.textContent = event.title;
                        
                        eventElement.appendChild(eventTime);
                        eventElement.appendChild(eventTitle);
                        
                        eventElement.onclick = (e) => {
                            e.stopPropagation();
                            editEvent(event.id);
                        };
                        
                        eventElement.title = event.title + ' - ' + eventTime.textContent;
                        
                        dayElement.appendChild(eventElement);
                    });

                    // Add event button
                    const addBtn = document.createElement('button');
                    addBtn.className = 'add-event-btn';
                    addBtn.textContent = '+';
                    addBtn.onclick = (e) => {
                        e.stopPropagation();
                        console.log('Add button clicked:', date.toDateString());
                        setTimeout(() => createEventForDate(date), 50);
                    };
                    dayElement.appendChild(addBtn);

                    // Click handler for day (only if no events)
                    dayElement.onclick = (e) => {
                        // Only create event if clicking on empty space
                        if (e.target === dayElement || e.target === dayNumber) {
                            console.log('Day clicked:', date.toDateString());
                            setTimeout(() => createEventForDate(date), 50);
                        }
                    };

                    grid.appendChild(dayElement);
                }
            }

            function isToday(date) {
                const today = new Date();
                return date.toDateString() === today.toDateString();
            }

            function createEventForDate(date) {
                console.log('Creating event for date:', date.toDateString());
                
                // Pre-fill the form with the selected date
                const startDate = new Date(date);
                startDate.setHours(9, 0, 0, 0); // Default to 9 AM
                const endDate = new Date(date);
                endDate.setHours(10, 0, 0, 0); // Default to 10 AM

                // Clear form and set up for new event
                currentEventId = null;
                
                // Update modal title and button
                const modalTitle = document.getElementById('modal-title');
                const saveButton = document.getElementById('save-button');
                const eventForm = document.getElementById('event-form');
                
                if (modalTitle) modalTitle.textContent = 'Create Event';
                if (saveButton) saveButton.textContent = 'Save Event';
                if (eventForm) eventForm.reset();
                
                // Pre-fill dates with error checking
                const startInput = document.getElementById('event-start');
                const endInput = document.getElementById('event-end');
                
                if (startInput) {
                    startInput.value = startDate.toISOString().slice(0, 16);
                } else {
                    console.error('Start date input not found');
                }
                
                if (endInput) {
                    endInput.value = endDate.toISOString().slice(0, 16);
                } else {
                    console.error('End date input not found');
                }
                
                // Show modal
                const modal = document.getElementById('event-modal');
                if (modal) {
                    modal.style.display = 'block';
                } else {
                    console.error('Event modal not found');
                    return;
                }
                
                // Focus on title field
                setTimeout(() => {
                    const titleField = document.getElementById('event-title');
                    if (titleField) {
                        titleField.focus();
                    }
                }, 100);
            }

            // Set up calendar navigation event listeners
            document.addEventListener('DOMContentLoaded', function() {
                // Wait for elements to be available
                setTimeout(() => {
                    const prevBtn = document.getElementById('prev-month');
                    const nextBtn = document.getElementById('next-month');
                    const todayBtn = document.getElementById('today-btn');
                    
                    if (prevBtn) prevBtn.onclick = () => navigateCalendar(-1);
                    if (nextBtn) nextBtn.onclick = () => navigateCalendar(1);
                    if (todayBtn) todayBtn.onclick = goToToday;
                }, 100);
            });

            // Debug function to test calendar functionality
            function testCalendarCreate() {
                const today = new Date();
                createEventForDate(today);
                console.log('Calendar create test triggered');
            }

            // Debug function to check if all elements exist
            function checkFormElements() {
                const elements = [
                    'event-modal',
                    'modal-title', 
                    'save-button',
                    'event-form',
                    'event-title',
                    'event-description',
                    'event-start',
                    'event-end',
                    'event-location',
                    'event-public'
                ];
                
                console.log('Checking form elements:');
                elements.forEach(id => {
                    const element = document.getElementById(id);
                    console.log(id + ':', element ? 'Found' : 'NOT FOUND');
                });
            }

            // Make functions globally available for debugging
            window.testCalendarCreate = testCalendarCreate;
            window.createEventForDate = createEventForDate;
            window.checkFormElements = checkFormElements;

            function renderEvents() {
                const eventsList = document.getElementById('events-list');
                
                if (events.length === 0) {
                    eventsList.innerHTML = \`
                        <div class="empty-state">
                            <p>No events found. Create your first event to get started!</p>
                        </div>
                    \`;
                    return;
                }

                eventsList.innerHTML = events.map(event => \`
                    <div class="event-item">
                        <div class="event-info">
                            <h3 class="event-title">\${escapeHtml(event.title)}</h3>
                            <p class="event-description">\${escapeHtml(event.description)}</p>
                            <div class="event-datetime">
                                \${formatDateTime(event.startDateTime)} - \${formatDateTime(event.endDateTime)}
                            </div>
                            \${event.location ? \`<div class="event-location">📍 \${escapeHtml(event.location)}</div>\` : ''}
                        </div>
                        <div class="event-actions">
                            <button class="edit-button" onclick="editEvent('\${event.id}')">Edit</button>
                            <button class="delete-button" onclick="deleteEvent('\${event.id}')">Delete</button>
                        </div>
                    </div>
                \`).join('');
            }

            function openCreateModal() {
                currentEventId = null;
                document.getElementById('modal-title').textContent = 'Create Event';
                document.getElementById('event-form').reset();
                document.getElementById('event-modal').style.display = 'block';
            }

            function editEvent(eventId) {
                const event = events.find(e => e.id === eventId);
                if (!event) return;

                currentEventId = eventId;
                document.getElementById('modal-title').textContent = 'Edit Event';
                
                // Populate form
                document.getElementById('event-title').value = event.title;
                document.getElementById('event-description').value = event.description;
                document.getElementById('event-start').value = formatDateTimeForInput(event.startDateTime);
                document.getElementById('event-end').value = formatDateTimeForInput(event.endDateTime);
                document.getElementById('event-location').value = event.location || '';
                document.getElementById('event-public').checked = event.isPublic;
                
                document.getElementById('event-modal').style.display = 'block';
            }

            function closeModal() {
                document.getElementById('event-modal').style.display = 'none';
                currentEventId = null;
            }

            async function saveEvent() {
                const form = document.getElementById('event-form');
                const formData = new FormData(form);
                const saveButton = document.getElementById('save-button');
                
                // Validate form
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                // Validate date range
                const startDate = new Date(formData.get('startDateTime'));
                const endDate = new Date(formData.get('endDateTime'));
                if (startDate >= endDate) {
                    showError('Start date must be before end date');
                    return;
                }

                const eventData = {
                    title: formData.get('title'),
                    description: formData.get('description'),
                    startDateTime: formData.get('startDateTime'),
                    endDateTime: formData.get('endDateTime'),
                    location: formData.get('location') || undefined,
                    isPublic: formData.get('isPublic') === 'on'
                };

                saveButton.disabled = true;
                saveButton.textContent = 'Saving...';

                try {
                    const url = currentEventId ? \`/api/events/\${currentEventId}\` : '/api/events';
                    const method = currentEventId ? 'PUT' : 'POST';
                    
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(eventData)
                    });

                    const result = await response.json();

                    if (result.success) {
                        closeModal();
                        await loadEvents(); // Reload events
                        if (currentView === 'calendar') {
                            renderCalendar();
                        }
                        clearError();
                    } else {
                        showError(result.errors ? result.errors.join(', ') : (result.error || 'Failed to save event'));
                    }
                } catch (error) {
                    showError('Network error. Please try again.');
                } finally {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save Event';
                }
            }

            async function deleteEvent(eventId) {
                if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                    return;
                }

                try {
                    const response = await fetch(\`/api/events/\${eventId}\`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();

                    if (result.success) {
                        await loadEvents(); // Reload events
                        clearError();
                    } else {
                        showError(result.error || 'Failed to delete event');
                    }
                } catch (error) {
                    showError('Network error. Please try again.');
                }
            }

            function showError(message) {
                const errorContainer = document.getElementById('error-container');
                errorContainer.innerHTML = \`<div class="error-message">\${escapeHtml(message)}</div>\`;
            }

            function clearError() {
                document.getElementById('error-container').innerHTML = '';
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function formatDateTime(dateTimeString) {
                const date = new Date(dateTimeString);
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            function formatDateTimeForInput(dateTimeString) {
                const date = new Date(dateTimeString);
                return date.toISOString().slice(0, 16);
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

            // Close modal when clicking outside
            window.onclick = function(event) {
                const modal = document.getElementById('event-modal');
                if (event.target === modal) {
                    closeModal();
                }
            }
        </script>
    </body>
    </html>
    `;

    res.send(eventsHtml);
  }

  /**
   * Get all events for the authenticated user's company
   */
  private async getEvents(req: Request, res: Response) {
    try {
      const user = req.user!;
      const result = await this.eventService.getCompanyEvents(user.companyId);

      if (result.success) {
        return res.json({
          success: true,
          events: result.events
        } as EventResponse);
      } else {
        return res.status(500).json({
          success: false,
          errors: result.errors
        } as EventResponse);
      }
    } catch (error) {
      console.error('Get events error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve events'
      } as EventResponse);
    }
  }

  /**
   * Get a single event by ID
   */
  private async getEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const result = await this.eventService.getEvent(id);

      if (result.success && result.event) {
        // Verify the event belongs to the user's company
        if (result.event.companyId !== user.companyId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          } as EventResponse);
        }

        return res.json({
          success: true,
          event: result.event
        } as EventResponse);
      } else {
        return res.status(404).json({
          success: false,
          errors: result.errors
        } as EventResponse);
      }
    } catch (error) {
      console.error('Get event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve event'
      } as EventResponse);
    }
  }

  /**
   * Create a new event
   */
  private async createEvent(req: Request, res: Response) {
    try {
      const user = req.user!;
      const eventRequest: CreateEventRequest = req.body;

      // Validate required fields
      if (!eventRequest.title || !eventRequest.description ||
        !eventRequest.startDateTime || !eventRequest.endDateTime) {
        return res.status(400).json({
          success: false,
          error: 'Title, description, start date, and end date are required'
        } as EventResponse);
      }

      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: user.companyId,
        title: eventRequest.title,
        description: eventRequest.description,
        startDateTime: new Date(eventRequest.startDateTime),
        endDateTime: new Date(eventRequest.endDateTime),
        location: eventRequest.location,
        isPublic: eventRequest.isPublic ?? true
      };

      const result = await this.eventService.createEvent(eventData);

      if (result.success) {
        return res.status(201).json({
          success: true,
          event: result.event
        } as EventResponse);
      } else {
        return res.status(400).json({
          success: false,
          errors: result.errors
        } as EventResponse);
      }
    } catch (error) {
      console.error('Create event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create event'
      } as EventResponse);
    }
  }

  /**
   * Update an existing event
   */
  private async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const eventRequest: UpdateEventRequest = req.body;

      // First verify the event exists and belongs to the user's company
      const existingResult = await this.eventService.getEvent(id);
      if (!existingResult.success || !existingResult.event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        } as EventResponse);
      }

      if (existingResult.event.companyId !== user.companyId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        } as EventResponse);
      }

      const updateData: UpdateEventData = {};
      if (eventRequest.title !== undefined) updateData.title = eventRequest.title;
      if (eventRequest.description !== undefined) updateData.description = eventRequest.description;
      if (eventRequest.startDateTime !== undefined) updateData.startDateTime = new Date(eventRequest.startDateTime);
      if (eventRequest.endDateTime !== undefined) updateData.endDateTime = new Date(eventRequest.endDateTime);
      if (eventRequest.location !== undefined) updateData.location = eventRequest.location;
      if (eventRequest.isPublic !== undefined) updateData.isPublic = eventRequest.isPublic;

      const result = await this.eventService.updateEvent(id, updateData);

      if (result.success) {
        return res.json({
          success: true,
          event: result.event
        } as EventResponse);
      } else {
        return res.status(400).json({
          success: false,
          errors: result.errors
        } as EventResponse);
      }
    } catch (error) {
      console.error('Update event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update event'
      } as EventResponse);
    }
  }

  /**
   * Delete an event
   */
  private async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      // First verify the event exists and belongs to the user's company
      const existingResult = await this.eventService.getEvent(id);
      if (!existingResult.success || !existingResult.event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        } as EventResponse);
      }

      if (existingResult.event.companyId !== user.companyId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        } as EventResponse);
      }

      const result = await this.eventService.deleteEvent(id);

      if (result.success) {
        return res.json({
          success: true
        } as EventResponse);
      } else {
        return res.status(500).json({
          success: false,
          errors: result.errors
        } as EventResponse);
      }
    } catch (error) {
      console.error('Delete event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event'
      } as EventResponse);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

export const eventRoutes = new EventRoutes();