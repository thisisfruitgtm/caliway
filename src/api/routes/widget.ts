import { Router, Request, Response } from 'express';
import { WidgetApiService } from '../../services/WidgetApiService';
import { EventRepository } from '../../repositories/EventRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { WidgetConfigRepository } from '../../repositories/WidgetConfigRepository';
import { authMiddleware } from '../middleware/auth';

export interface WidgetConfigRequest {
    theme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    showUpcomingOnly?: boolean;
    maxEvents?: number;
    dateFormat?: string;
}

export interface WidgetConfigResponse {
    success: boolean;
    config?: any;
    error?: string;
}

export class WidgetRoutes {
    private router: Router;
    private widgetApiService: WidgetApiService;

    constructor() {
        this.router = Router();

        // Initialize service with repositories
        const eventRepository = new EventRepository();
        const companyRepository = new CompanyRepository();
        const widgetConfigRepository = new WidgetConfigRepository();

        this.widgetApiService = new WidgetApiService(
            eventRepository,
            companyRepository,
            widgetConfigRepository
        );

        this.setupRoutes();
    }

    private setupRoutes() {
        // Widget customization page (protected route)
        this.router.get('/',
            authMiddleware.requireAuth({ redirectUrl: '/login' }),
            this.renderWidgetPage.bind(this)
        );

        // Get widget configuration (API)
        this.router.get('/config',
            authMiddleware.requireAuth({ returnJson: true }),
            this.getWidgetConfig.bind(this)
        );

        // Update widget configuration (API)
        this.router.put('/config',
            authMiddleware.requireAuth({ returnJson: true }),
            this.updateWidgetConfig.bind(this)
        );

        // Generate widget script (API)
        this.router.get('/script',
            authMiddleware.requireAuth({ returnJson: true }),
            this.generateWidgetScript.bind(this)
        );

        // Widget events API (public)
        this.router.get('/:companyId/events', this.getWidgetEvents.bind(this));
    }

    /**
     * Render widget customization page
     */
    private renderWidgetPage(req: Request, res: Response) {
        const user = req.user!;

        const widgetPageHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Widget Generator - Company Calendar</title>
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
                transition: background-color 0.2s;
            }
            .nav-link:hover {
                background: #f0f0f0;
            }
            .main-content {
                padding: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            .page-header {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 2rem;
            }
            .content-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2rem;
            }
            .config-panel {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .preview-panel {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .form-group {
                margin-bottom: 1.5rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: #333;
            }
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
                box-sizing: border-box;
            }
            .form-group input[type="checkbox"] {
                width: auto;
                margin-right: 0.5rem;
            }
            .checkbox-group {
                display: flex;
                align-items: center;
            }
            .button {
                background: #667eea;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 0.5rem;
            }
            .button:hover {
                background: #5a6fd8;
            }
            .button.secondary {
                background: #6c757d;
            }
            .button.secondary:hover {
                background: #5a6268;
            }
            .code-container {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 5px;
                padding: 1rem;
                margin-top: 1rem;
                position: relative;
            }
            .code-container pre {
                margin: 0;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                line-height: 1.4;
                overflow-x: auto;
            }
            .copy-button {
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: #28a745;
                color: white;
                border: none;
                padding: 0.25rem 0.5rem;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            }
            .copy-button:hover {
                background: #218838;
            }
            .preview-container {
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 1rem;
                margin-top: 1rem;
                background: #fff;
            }
            .loading {
                text-align: center;
                color: #666;
                padding: 2rem;
            }
            .error {
                color: #dc3545;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                padding: 0.75rem;
                border-radius: 5px;
                margin-top: 1rem;
            }
            .success {
                color: #155724;
                background: #d4edda;
                border: 1px solid #c3e6cb;
                padding: 0.75rem;
                border-radius: 5px;
                margin-top: 1rem;
            }
            @media (max-width: 768px) {
                .content-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Widget Generator</h1>
            <div class="nav-links">
                <a href="/dashboard" class="nav-link">← Back to Dashboard</a>
            </div>
        </div>
        
        <div class="main-content">
            <div class="page-header">
                <h2>Embeddable Calendar Widget</h2>
                <p>Customize and generate embeddable JavaScript code to display your calendar events on your website.</p>
            </div>
            
            <div class="content-grid">
                <div class="config-panel">
                    <h3>Widget Configuration</h3>
                    <form id="widgetConfigForm">
                        <div class="form-group">
                            <label for="theme">Theme</label>
                            <select id="theme" name="theme">
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="primaryColor">Primary Color</label>
                            <input type="color" id="primaryColor" name="primaryColor" value="#007bff">
                        </div>
                        
                        <div class="form-group">
                            <div class="checkbox-group">
                                <input type="checkbox" id="showUpcomingOnly" name="showUpcomingOnly" checked>
                                <label for="showUpcomingOnly">Show upcoming events only</label>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="maxEvents">Maximum events to display</label>
                            <input type="number" id="maxEvents" name="maxEvents" value="10" min="1" max="50">
                        </div>
                        
                        <div class="form-group">
                            <label for="dateFormat">Date format</label>
                            <select id="dateFormat" name="dateFormat">
                                <option value="MMM DD, YYYY">Jan 15, 2024</option>
                                <option value="DD/MM/YYYY">15/01/2024</option>
                                <option value="MM/DD/YYYY">01/15/2024</option>
                                <option value="YYYY-MM-DD">2024-01-15</option>
                            </select>
                        </div>
                        
                        <button type="button" class="button" onclick="updatePreview()">Update Preview</button>
                        <button type="button" class="button secondary" onclick="saveConfiguration()">Save Configuration</button>
                    </form>
                    
                    <div id="configMessage"></div>
                </div>
                
                <div class="preview-panel">
                    <h3>Preview & Code</h3>
                    
                    <div>
                        <h4>Widget Preview</h4>
                        <div class="preview-container">
                            <div id="calendar-widget-preview" class="loading">Loading preview...</div>
                        </div>
                    </div>
                    
                    <div>
                        <h4>Embed Code</h4>
                        <p>Copy this code and paste it into your website where you want the calendar widget to appear:</p>
                        <div class="code-container">
                            <button class="copy-button" onclick="copyEmbedCode()">Copy</button>
                            <pre id="embedCode">Loading...</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let currentConfig = {};
            
            // Load initial configuration
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOM loaded, initializing widget page...');
                loadConfiguration();
            });
            
            // Debug function to test widget functionality
            function testWidget() {
                console.log('Testing widget functionality...');
                console.log('Current config:', currentConfig);
                updatePreview();
            }
            
            // Make test function globally available
            window.testWidget = testWidget;
            
            async function loadConfiguration() {
                console.log('Loading widget configuration...');
                try {
                    const response = await fetch('/widget/config', {
                        credentials: 'include'
                    });
                    console.log('Config response status:', response.status);
                    const data = await response.json();
                    console.log('Config data:', data);
                    
                    if (data.success && data.config) {
                        currentConfig = data.config;
                        populateForm(data.config);
                        updatePreview();
                        console.log('Configuration loaded successfully');
                    } else {
                        console.error('Failed to load configuration:', data);
                        showMessage('Failed to load configuration: ' + (data.error || 'No config data'), 'error');
                    }
                } catch (error) {
                    console.error('Error loading configuration:', error);
                    showMessage('Error loading configuration. Please refresh the page.', 'error');
                }
            }
            
            function populateForm(config) {
                document.getElementById('theme').value = config.theme || 'light';
                document.getElementById('primaryColor').value = config.primaryColor || '#007bff';
                document.getElementById('showUpcomingOnly').checked = config.showUpcomingOnly !== false;
                document.getElementById('maxEvents').value = config.maxEvents || 10;
                document.getElementById('dateFormat').value = config.dateFormat || 'MMM DD, YYYY';
            }
            
            function getFormData() {
                return {
                    theme: document.getElementById('theme').value,
                    primaryColor: document.getElementById('primaryColor').value,
                    showUpcomingOnly: document.getElementById('showUpcomingOnly').checked,
                    maxEvents: parseInt(document.getElementById('maxEvents').value),
                    dateFormat: document.getElementById('dateFormat').value
                };
            }
            
            async function updatePreview() {
                console.log('Updating preview...');
                const formData = getFormData();
                console.log('Form data:', formData);
                currentConfig = { ...currentConfig, ...formData };
                
                // Update preview widget
                const previewContainer = document.getElementById('calendar-widget-preview');
                previewContainer.innerHTML = '<div class="loading">Updating preview...</div>';
                
                try {
                    // Generate embed code
                    const response = await fetch('/widget/script', {
                        credentials: 'include'
                    });
                    console.log('Script response status:', response.status);
                    const data = await response.json();
                    console.log('Script data:', data);
                    
                    if (data.success && data.script) {
                        // Update embed code display
                        const embedCodeElement = document.getElementById('embedCode');
                        const embedCode = generateEmbedCode(data.script);
                        embedCodeElement.textContent = embedCode;
                        
                        // Create preview widget
                        createPreviewWidget(formData);
                        console.log('Preview updated successfully');
                    } else {
                        console.error('Failed to generate script:', data);
                        previewContainer.innerHTML = '<div class="error">Failed to generate preview</div>';
                        showMessage('Failed to generate widget script', 'error');
                    }
                } catch (error) {
                    console.error('Error updating preview:', error);
                    previewContainer.innerHTML = '<div class="error">Failed to update preview</div>';
                }
            }
            
            function createPreviewWidget(config) {
                const previewContainer = document.getElementById('calendar-widget-preview');
                
                // Create mock widget structure
                const widget = document.createElement('div');
                widget.style.fontFamily = 'Arial, sans-serif';
                widget.style.maxWidth = '400px';
                widget.style.border = '1px solid #ddd';
                widget.style.borderRadius = '8px';
                widget.style.padding = '16px';
                widget.style.backgroundColor = config.theme === 'dark' ? '#333' : '#fff';
                widget.style.color = config.theme === 'dark' ? '#fff' : '#333';
                
                // Header
                const header = document.createElement('h3');
                header.textContent = 'Upcoming Events';
                header.style.marginTop = '0';
                header.style.color = config.primaryColor;
                header.style.fontSize = '18px';
                header.style.marginBottom = '16px';
                
                // Mock events
                const eventsContainer = document.createElement('div');
                eventsContainer.style.display = 'flex';
                eventsContainer.style.flexDirection = 'column';
                eventsContainer.style.gap = '12px';
                
                // Create sample events
                const sampleEvents = [
                    { title: 'Team Meeting', date: 'Tomorrow at 10:00 AM', description: 'Weekly team sync meeting' },
                    { title: 'Product Launch', date: 'Next Week', description: 'Launch of our new product line' }
                ];
                
                sampleEvents.slice(0, config.maxEvents).forEach(function(event) {
                    const eventDiv = document.createElement('div');
                    eventDiv.style.padding = '12px';
                    eventDiv.style.border = '1px solid #eee';
                    eventDiv.style.borderRadius = '4px';
                    eventDiv.style.cursor = 'pointer';
                    
                    const title = document.createElement('div');
                    title.textContent = event.title;
                    title.style.fontWeight = 'bold';
                    title.style.color = config.primaryColor;
                    title.style.marginBottom = '4px';
                    
                    const date = document.createElement('div');
                    date.textContent = event.date;
                    date.style.fontSize = '14px';
                    date.style.color = '#666';
                    date.style.marginBottom = '4px';
                    
                    const description = document.createElement('div');
                    description.textContent = event.description;
                    description.style.fontSize = '14px';
                    
                    eventDiv.appendChild(title);
                    eventDiv.appendChild(date);
                    eventDiv.appendChild(description);
                    eventsContainer.appendChild(eventDiv);
                });
                
                widget.appendChild(header);
                widget.appendChild(eventsContainer);
                
                previewContainer.innerHTML = '';
                previewContainer.appendChild(widget);
            }
            
            function generateEmbedCode(script) {
                const baseUrl = window.location.origin;
                return '<!-- Calendar Widget -->' + 
                       '<div id="calendar-widget"></div>' +
                       '<script src="' + baseUrl + '/public/widget.js" ' +
                       'data-company-id="' + currentConfig.companyId + '" ' +
                       'data-api-url="' + baseUrl + '" ' +
                       'data-theme="' + (currentConfig.theme || 'light') + '" ' +
                       'data-primary-color="' + (currentConfig.primaryColor || '#007bff') + '" ' +
                       'data-show-upcoming-only="' + (currentConfig.showUpcomingOnly !== false) + '" ' +
                       'data-max-events="' + (currentConfig.maxEvents || 10) + '">' +
                       '</script>';
            }
            
            async function saveConfiguration() {
                const formData = getFormData();
                
                try {
                    const response = await fetch('/widget/config', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify(formData)
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        showMessage('Configuration saved successfully!', 'success');
                        currentConfig = { ...currentConfig, ...formData };
                        updatePreview();
                    } else {
                        showMessage(data.error || 'Failed to save configuration', 'error');
                    }
                } catch (error) {
                    console.error('Error saving configuration:', error);
                    showMessage('Failed to save configuration', 'error');
                }
            }
            
            function copyEmbedCode() {
                const embedCode = document.getElementById('embedCode').textContent;
                
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(embedCode).then(function() {
                        const button = document.querySelector('.copy-button');
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        setTimeout(function() {
                            button.textContent = originalText;
                        }, 2000);
                    }).catch(function(err) {
                        console.error('Failed to copy:', err);
                        fallbackCopy(embedCode);
                    });
                } else {
                    fallbackCopy(embedCode);
                }
            }
            
            function fallbackCopy(text) {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    showMessage('Code copied to clipboard!', 'success');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    showMessage('Failed to copy code. Please copy manually.', 'error');
                }
                
                document.body.removeChild(textArea);
            }
            
            function showMessage(message, type) {
                const messageContainer = document.getElementById('configMessage');
                messageContainer.innerHTML = '<div class="' + type + '">' + message + '</div>';
                
                setTimeout(function() {
                    messageContainer.innerHTML = '';
                }, 5000);
            }
        </script>
    </body>
    </html>
    `;

        res.send(widgetPageHtml);
    }

    /**
     * Get widget configuration
     */
    private async getWidgetConfig(req: Request, res: Response) {
        try {
            const user = req.user!;
            const config = await this.widgetApiService.getWidgetConfig(user.companyId);

            res.json({
                success: true,
                config
            });
        } catch (error) {
            console.error('Error getting widget config:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get widget configuration'
            });
        }
    }

    /**
     * Update widget configuration
     */
    private async updateWidgetConfig(req: Request, res: Response) {
        try {
            const user = req.user!;
            const configUpdate: WidgetConfigRequest = req.body;

            const updatedConfig = await this.widgetApiService.updateWidgetConfig(
                user.companyId,
                configUpdate
            );

            res.json({
                success: true,
                config: updatedConfig
            });
        } catch (error) {
            console.error('Error updating widget config:', error);
            res.status(400).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update widget configuration'
            });
        }
    }

    /**
     * Generate widget script
     */
    private async generateWidgetScript(req: Request, res: Response) {
        try {
            const user = req.user!;
            const script = await this.widgetApiService.generateWidgetScript(user.companyId);

            res.json({
                success: true,
                script
            });
        } catch (error) {
            console.error('Error generating widget script:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate widget script'
            });
        }
    }

    /**
     * Get widget events (public API)
     */
    private async getWidgetEvents(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const events = await this.widgetApiService.getWidgetEvents(companyId);

            res.json(events);
        } catch (error) {
            console.error('Error getting widget events:', error);
            res.status(404).json({
                error: 'Company not found or no events available'
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
