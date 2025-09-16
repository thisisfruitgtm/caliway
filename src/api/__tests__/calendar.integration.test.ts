import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UrlGenerationService } from '../../services/UrlGenerationService';
import { CalendarFeedService } from '../../services/CalendarFeedService';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { EventRepository } from '../../repositories/EventRepository';

// Mock the repositories and services
vi.mock('../../repositories/UserRepository');
vi.mock('../../repositories/CompanyRepository');
vi.mock('../../repositories/EventRepository');
vi.mock('../../services/AuthenticationService');
vi.mock('../../services/UrlGenerationService');
vi.mock('../../services/CalendarFeedService');

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
    authMiddleware: {
        requireAuth: vi.fn(() => (req: any, res: any, next: any) => {
            // Mock authenticated user for protected routes
            req.user = {
                id: 'user-123',
                username: 'testuser',
                companyId: 'company-123'
            };
            next();
        }),
        redirectIfAuthenticated: vi.fn(() => (req: any, res: any, next: any) => next())
    }
}));

describe('Calendar Routes Integration Tests', () => {
    let mockUserRepository: any;
    let mockCompanyRepository: any;
    let mockEventRepository: any;
    let mockAuthService: any;
    let mockUrlService: any;
    let mockFeedService: any;
    let authToken: string;

    const mockUser = {
        id: 'user-123',
        username: 'testuser',
        companyId: 'company-123',
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        lastLoginAt: new Date()
    };

    const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        shareableUrl: 'cal-test-url-123',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockEvents = [
        {
            id: 'event-1',
            companyId: 'company-123',
            title: 'Team Meeting',
            description: 'Weekly team sync meeting',
            startDateTime: new Date('2024-01-15T10:00:00Z'),
            endDateTime: new Date('2024-01-15T11:00:00Z'),
            location: 'Conference Room A',
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 'event-2',
            companyId: 'company-123',
            title: 'Product Launch',
            description: 'Launch event for our new product',
            startDateTime: new Date('2024-01-20T14:00:00Z'),
            endDateTime: new Date('2024-01-20T16:00:00Z'),
            location: 'Main Auditorium',
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock UserRepository
        mockUserRepository = {
            findById: vi.fn(),
            findByUsername: vi.fn(),
            findByCompanyId: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            updateLastLogin: vi.fn()
        };

        // Mock CompanyRepository
        mockCompanyRepository = {
            findById: vi.fn(),
            findByShareableUrl: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            isShareableUrlUnique: vi.fn()
        };

        // Mock EventRepository
        mockEventRepository = {
            findById: vi.fn(),
            findByCompanyId: vi.fn(),
            findPublicByCompanyId: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };

        // Mock AuthenticationService
        mockAuthService = {
            authenticate: vi.fn(),
            validateSession: vi.fn(),
            logout: vi.fn(),
            hashPassword: vi.fn(),
            generateSessionToken: vi.fn()
        };

        // Mock UrlGenerationService
        mockUrlService = {
            generateShareableUrl: vi.fn(),
            getCompanyByShareUrl: vi.fn(),
            generateCalendarSubscriptionUrls: vi.fn(),
            generateEmbedCode: vi.fn(),
            ensureCompanyHasShareableUrl: vi.fn()
        };

        // Mock CalendarFeedService
        mockFeedService = {
            generateICalFeed: vi.fn(),
            getPublicEvents: vi.fn(),
            formatEventForFeed: vi.fn()
        };



        // Set up constructor mocks
        vi.mocked(UserRepository).mockImplementation(() => mockUserRepository);
        vi.mocked(CompanyRepository).mockImplementation(() => mockCompanyRepository);
        vi.mocked(EventRepository).mockImplementation(() => mockEventRepository);
        vi.mocked(AuthenticationService).mockImplementation(() => mockAuthService);
        vi.mocked(UrlGenerationService).mockImplementation(() => mockUrlService);
        vi.mocked(CalendarFeedService).mockImplementation(() => mockFeedService);
        // Note: Auth middleware mocking is complex in integration tests
        // For now, we'll focus on unit tests for the service layer

        // Generate a test auth token
        authToken = 'test-auth-token';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /calendar/share', () => {
        it('should render the share page for authenticated users', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });

            // Act
            const response = await request(app)
                .get('/calendar/share')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(200);
            expect(response.text).toContain('Share Your Calendar');
            expect(response.text).toContain('Generate shareable URLs');
        });

        it('should redirect unauthenticated users to login', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: false,
                error: 'Invalid token'
            });

            // Act
            const response = await request(app)
                .get('/calendar/share');

            // Assert
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('GET /api/calendar/share-url', () => {
        it('should return existing shareable URL for authenticated user', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.ensureCompanyHasShareableUrl.mockResolvedValue('cal-test-url-123');

            // Act
            const response = await request(app)
                .get('/api/calendar/share-url')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                shareableUrl: 'cal-test-url-123'
            });
            expect(mockUrlService.ensureCompanyHasShareableUrl).toHaveBeenCalledWith('company-123');
        });

        it('should return 401 for unauthenticated requests', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: false,
                error: 'Invalid token'
            });

            // Act
            const response = await request(app)
                .get('/api/calendar/share-url');

            // Assert
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.ensureCompanyHasShareableUrl.mockRejectedValue(new Error('Service error'));

            // Act
            const response = await request(app)
                .get('/api/calendar/share-url')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                error: 'Failed to retrieve shareable URL'
            });
        });
    });

    describe('POST /api/calendar/generate-url', () => {
        it('should generate new shareable URL for authenticated user', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.generateShareableUrl.mockResolvedValue('cal-new-url-456');

            // Act
            const response = await request(app)
                .post('/api/calendar/generate-url')
                .set('Cookie', [`authToken=${authToken}`])
                .send();

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                shareableUrl: 'cal-new-url-456'
            });
            expect(mockUrlService.generateShareableUrl).toHaveBeenCalledWith('company-123');
        });

        it('should return 401 for unauthenticated requests', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: false,
                error: 'Invalid token'
            });

            // Act
            const response = await request(app)
                .post('/api/calendar/generate-url')
                .send();

            // Assert
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/calendar/subscription-urls/:shareUrl', () => {
        it('should return subscription URLs for valid share URL', async () => {
            // Arrange
            const mockCalendarUrls = {
                icalFeed: 'https://example.com/calendar/cal-test-url-123/feed.ics',
                googleCalendar: 'https://calendar.google.com/calendar/render?cid=...',
                outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar?url=...',
                appleCalendar: 'webcal://example.com/calendar/cal-test-url-123/feed.ics'
            };

            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
            mockUrlService.generateCalendarSubscriptionUrls.mockReturnValue(mockCalendarUrls);

            // Act
            const response = await request(app)
                .get('/api/calendar/subscription-urls/cal-test-url-123')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                calendarUrls: mockCalendarUrls
            });
            expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('cal-test-url-123');
            expect(mockUrlService.generateCalendarSubscriptionUrls).toHaveBeenCalledWith('cal-test-url-123');
        });

        it('should return 403 for share URL not belonging to user company', async () => {
            // Arrange
            const otherCompany = { ...mockCompany, id: 'other-company-456' };

            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.getCompanyByShareUrl.mockResolvedValue(otherCompany);

            // Act
            const response = await request(app)
                .get('/api/calendar/subscription-urls/cal-other-url')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                success: false,
                error: 'Access denied'
            });
        });

        it('should return 403 for non-existent share URL', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.getCompanyByShareUrl.mockResolvedValue(null);

            // Act
            const response = await request(app)
                .get('/api/calendar/subscription-urls/non-existent-url')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                success: false,
                error: 'Access denied'
            });
        });
    });

    describe('GET /api/calendar/embed-code', () => {
        it('should return embed code for authenticated user', async () => {
            // Arrange
            const mockEmbedCode = `<!-- Company Calendar Widget -->
<div id="company-calendar-widget-cal-test-url-123"></div>
<script>
// Widget initialization code
</script>`;

            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.generateEmbedCode.mockResolvedValue(mockEmbedCode);

            // Act
            const response = await request(app)
                .get('/api/calendar/embed-code')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                embedCode: mockEmbedCode
            });
            expect(mockUrlService.generateEmbedCode).toHaveBeenCalledWith('company-123');
        });

        it('should return 401 for unauthenticated requests', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: false,
                error: 'Invalid token'
            });

            // Act
            const response = await request(app)
                .get('/api/calendar/embed-code');

            // Assert
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            mockAuthService.validateSession.mockResolvedValue({
                valid: true,
                user: mockUser
            });
            mockUrlService.generateEmbedCode.mockRejectedValue(new Error('Service error'));

            // Act
            const response = await request(app)
                .get('/api/calendar/embed-code')
                .set('Cookie', [`authToken=${authToken}`]);

            // Assert
            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                error: 'Failed to generate embed code'
            });
        });
    });

    describe('Public Calendar Access (No Authentication Required)', () => {
        describe('GET /calendar/:shareUrl', () => {
            it('should display public calendar view with events for valid share URL', async () => {
                // Arrange
                const mockCalendarUrls = {
                    icalFeed: 'https://example.com/calendar/cal-test-url-123/feed.ics',
                    googleCalendar: 'https://calendar.google.com/calendar/render?cid=...',
                    outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar?url=...',
                    appleCalendar: 'webcal://example.com/calendar/cal-test-url-123/feed.ics'
                };

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.getPublicEvents.mockResolvedValue(mockEvents);
                mockUrlService.generateCalendarSubscriptionUrls.mockReturnValue(mockCalendarUrls);

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123');

                // Assert
                expect(response.status).toBe(200);
                expect(response.text).toContain('Test Company');
                expect(response.text).toContain('Public Calendar');
                expect(response.text).toContain('Team Meeting');
                expect(response.text).toContain('Product Launch');
                expect(response.text).toContain('Subscribe to Our Calendar');
                expect(response.text).toContain('Add to Google Calendar');
                expect(response.text).toContain('Add to Outlook');
                expect(response.text).toContain('Add to Apple Calendar');
                expect(response.text).toContain('Download iCal Feed');

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('cal-test-url-123');
                expect(mockFeedService.getPublicEvents).toHaveBeenCalledWith('company-123');
                expect(mockUrlService.generateCalendarSubscriptionUrls).toHaveBeenCalledWith('cal-test-url-123');
            });

            it('should display public calendar view with no events message when no events exist', async () => {
                // Arrange
                const mockCalendarUrls = {
                    icalFeed: 'https://example.com/calendar/cal-test-url-123/feed.ics',
                    googleCalendar: 'https://calendar.google.com/calendar/render?cid=...',
                    outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar?url=...',
                    appleCalendar: 'webcal://example.com/calendar/cal-test-url-123/feed.ics'
                };

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.getPublicEvents.mockResolvedValue([]);
                mockUrlService.generateCalendarSubscriptionUrls.mockReturnValue(mockCalendarUrls);

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123');

                // Assert
                expect(response.status).toBe(200);
                expect(response.text).toContain('Test Company');
                expect(response.text).toContain('Public Calendar');
                expect(response.text).toContain('No upcoming events');
                expect(response.text).toContain('Check back later for new events!');
                expect(response.text).toContain('Subscribe to Our Calendar');

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('cal-test-url-123');
                expect(mockFeedService.getPublicEvents).toHaveBeenCalledWith('company-123');
            });

            it('should return 404 for non-existent share URL', async () => {
                // Arrange
                mockUrlService.getCompanyByShareUrl.mockResolvedValue(null);

                // Act
                const response = await request(app)
                    .get('/calendar/non-existent-url');

                // Assert
                expect(response.status).toBe(404);
                expect(response.text).toContain('Calendar Not Found');
                expect(response.text).toContain('The calendar you\'re looking for doesn\'t exist');

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('non-existent-url');
                expect(mockFeedService.getPublicEvents).not.toHaveBeenCalled();
            });

            it('should handle service errors gracefully', async () => {
                // Arrange
                mockUrlService.getCompanyByShareUrl.mockRejectedValue(new Error('Database error'));

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123');

                // Assert
                expect(response.status).toBe(500);
                expect(response.text).toContain('Internal server error');
            });

            it('should properly escape HTML in event data to prevent XSS', async () => {
                // Arrange
                const maliciousEvents = [
                    {
                        id: 'event-xss',
                        companyId: 'company-123',
                        title: '<script>alert("xss")</script>Malicious Event',
                        description: '<img src="x" onerror="alert(\'xss\')">Description with XSS',
                        startDateTime: new Date('2024-01-15T10:00:00Z'),
                        endDateTime: new Date('2024-01-15T11:00:00Z'),
                        location: '<script>alert("location")</script>Conference Room',
                        isPublic: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];

                const mockCalendarUrls = {
                    icalFeed: 'https://example.com/calendar/cal-test-url-123/feed.ics',
                    googleCalendar: 'https://calendar.google.com/calendar/render?cid=...',
                    outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar?url=...',
                    appleCalendar: 'webcal://example.com/calendar/cal-test-url-123/feed.ics'
                };

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.getPublicEvents.mockResolvedValue(maliciousEvents);
                mockUrlService.generateCalendarSubscriptionUrls.mockReturnValue(mockCalendarUrls);

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123');

                // Assert
                expect(response.status).toBe(200);
                expect(response.text).not.toContain('<script>');
                expect(response.text).not.toContain('onerror=');
                expect(response.text).toContain('&lt;script&gt;');
                expect(response.text).toContain('&lt;img src=&quot;x&quot;');
            });
        });

        describe('GET /calendar/:shareUrl/feed.ics', () => {
            it('should return iCal feed for valid share URL', async () => {
                // Arrange
                const mockICalFeed = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test Company//Test Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Test Company Calendar
X-WR-TIMEZONE:UTC
BEGIN:VEVENT
UID:event-1@example.com
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Team Meeting
DESCRIPTION:Weekly team sync meeting
LOCATION:Conference Room A
END:VEVENT
END:VCALENDAR`;

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.generateICalFeed.mockResolvedValue(mockICalFeed);

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123/feed.ics');

                // Assert
                expect(response.status).toBe(200);
                expect(response.headers['content-type']).toContain('text/calendar');
                expect(response.headers['content-disposition']).toContain('Test Company-calendar.ics');
                expect(response.text).toBe(mockICalFeed);

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('cal-test-url-123');
                expect(mockFeedService.generateICalFeed).toHaveBeenCalledWith('company-123');
            });

            it('should return cached feed when available', async () => {
                // Arrange
                const mockICalFeed = 'CACHED_FEED_CONTENT';

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.generateICalFeed.mockResolvedValue(mockICalFeed);

                // Act - First request to populate cache
                await request(app).get('/calendar/cal-test-url-123/feed.ics');

                // Act - Second request should use cache
                const response = await request(app)
                    .get('/calendar/cal-test-url-123/feed.ics');

                // Assert
                expect(response.status).toBe(200);
                expect(response.headers['x-cache']).toBe('HIT');
                expect(mockFeedService.generateICalFeed).toHaveBeenCalledTimes(1); // Only called once due to caching
            });

            it('should return 404 for non-existent share URL', async () => {
                // Arrange
                mockUrlService.getCompanyByShareUrl.mockResolvedValue(null);

                // Act
                const response = await request(app)
                    .get('/calendar/non-existent-url/feed.ics');

                // Assert
                expect(response.status).toBe(404);
                expect(response.text).toContain('Calendar not found');

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('non-existent-url');
                expect(mockFeedService.generateICalFeed).not.toHaveBeenCalled();
            });

            it('should handle feed generation errors gracefully', async () => {
                // Arrange
                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.generateICalFeed.mockRejectedValue(new Error('Feed generation failed'));

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123/feed.ics');

                // Assert
                expect(response.status).toBe(500);
                expect(response.text).toContain('Internal server error');
            });
        });

        describe('GET /calendar/:shareUrl/feed', () => {
            it('should return iCal feed for alternative feed URL format', async () => {
                // Arrange
                const mockICalFeed = 'ICAL_FEED_CONTENT';

                mockUrlService.getCompanyByShareUrl.mockResolvedValue(mockCompany);
                mockFeedService.generateICalFeed.mockResolvedValue(mockICalFeed);

                // Act
                const response = await request(app)
                    .get('/calendar/cal-test-url-123/feed');

                // Assert
                expect(response.status).toBe(200);
                expect(response.headers['content-type']).toContain('text/calendar');
                expect(response.text).toBe(mockICalFeed);

                expect(mockUrlService.getCompanyByShareUrl).toHaveBeenCalledWith('cal-test-url-123');
                expect(mockFeedService.generateICalFeed).toHaveBeenCalledWith('company-123');
            });
        });
    });
});