import { Router, Request, Response } from 'express';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UserRepository } from '../../repositories/UserRepository';
import { authMiddleware } from '../middleware/auth';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    companyId: string;
  };
  error?: string;
}

export class AuthRoutes {
  private router: Router;
  private authService: AuthenticationService;

  constructor() {
    this.router = Router();
    const userRepository = new UserRepository();
    this.authService = new AuthenticationService(userRepository);
    this.setupRoutes();
  }

  private setupRoutes() {
    // Login page (GET)
    this.router.get('/login', 
      authMiddleware.redirectIfAuthenticated('/dashboard'),
      this.renderLoginPage.bind(this)
    );

    // Login API (POST)
    this.router.post('/login', this.handleLogin.bind(this));

    // Logout API (POST)
    this.router.post('/logout', this.handleLogout.bind(this));

    // Dashboard (protected route)
    this.router.get('/dashboard',
      authMiddleware.requireAuth({ redirectUrl: '/login' }),
      this.renderDashboard.bind(this)
    );

    // Session validation API
    this.router.get('/api/session',
      authMiddleware.requireAuth({ returnJson: true }),
      this.validateSession.bind(this)
    );
  }

  /**
   * Render login page
   */
  private renderLoginPage(req: Request, res: Response) {
    const loginHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Company Calendar - Login</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .login-container {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 400px;
            }
            .login-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .login-header h1 {
                color: #333;
                margin: 0 0 0.5rem 0;
            }
            .login-header p {
                color: #666;
                margin: 0;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            label {
                display: block;
                margin-bottom: 0.5rem;
                color: #333;
                font-weight: 500;
            }
            input[type="text"], input[type="password"] {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e1e5e9;
                border-radius: 5px;
                font-size: 1rem;
                transition: border-color 0.3s;
                box-sizing: border-box;
            }
            input[type="text"]:focus, input[type="password"]:focus {
                outline: none;
                border-color: #667eea;
            }
            .login-button {
                width: 100%;
                padding: 0.75rem;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 5px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .login-button:hover {
                background: #5a6fd8;
            }
            .login-button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .error-message {
                background: #fee;
                color: #c33;
                padding: 0.75rem;
                border-radius: 5px;
                margin-bottom: 1rem;
                border: 1px solid #fcc;
            }
            .loading {
                display: none;
                text-align: center;
                margin-top: 1rem;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-header">
                <h1>Company Calendar</h1>
                <p>Sign in to manage your calendar</p>
            </div>
            
            <div id="error-container"></div>
            
            <form id="login-form">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required>
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                
                <button type="submit" class="login-button" id="login-button">
                    Sign In
                </button>
                
                <div class="loading" id="loading">
                    Signing in...
                </div>
            </form>
        </div>

        <script>
            document.getElementById('login-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const button = document.getElementById('login-button');
                const loading = document.getElementById('loading');
                const errorContainer = document.getElementById('error-container');
                
                // Clear previous errors
                errorContainer.innerHTML = '';
                
                // Show loading state
                button.disabled = true;
                loading.style.display = 'block';
                
                try {
                    const formData = new FormData(e.target);
                    const response = await fetch('/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            username: formData.get('username'),
                            password: formData.get('password')
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Redirect to dashboard
                        window.location.href = '/dashboard';
                    } else {
                        // Show error
                        errorContainer.innerHTML = \`
                            <div class="error-message">
                                \${result.error || 'Login failed. Please try again.'}
                            </div>
                        \`;
                    }
                } catch (error) {
                    errorContainer.innerHTML = \`
                        <div class="error-message">
                            Network error. Please check your connection and try again.
                        </div>
                    \`;
                } finally {
                    // Reset loading state
                    button.disabled = false;
                    loading.style.display = 'none';
                }
            });
        </script>
    </body>
    </html>
    `;

    res.send(loginHtml);
  }

  /**
   * Handle login API request
   */
  private async handleLogin(req: Request, res: Response) {
    try {
      const { username, password }: LoginRequest = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        } as LoginResponse);
      }

      const result = await this.authService.authenticate(username, password);

      if (result.success && result.user && result.token) {
        // Set HTTP-only cookie for web sessions
        res.cookie('authToken', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        return res.json({
          success: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            companyId: result.user.companyId
          }
        } as LoginResponse);
      } else {
        return res.status(401).json({
          success: false,
          error: result.error || 'Authentication failed'
        } as LoginResponse);
      }
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      } as LoginResponse);
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout(req: Request, res: Response) {
    try {
      // Get token from cookie or header
      const token = req.cookies?.authToken || 
                   (req.headers.authorization?.startsWith('Bearer ') ? 
                    req.headers.authorization.substring(7) : null);

      if (token) {
        await this.authService.logout(token);
      }

      // Clear cookie
      res.clearCookie('authToken');

      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * Render dashboard page
   */
  private renderDashboard(req: Request, res: Response) {
    const user = req.user!;
    
    const dashboardHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Company Calendar - Dashboard</title>
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
            .user-info {
                display: flex;
                align-items: center;
                gap: 1rem;
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
            .welcome-card {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 2rem;
            }
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1rem;
            }
            .feature-card {
                background: white;
                padding: 1.5rem;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .feature-card h3 {
                margin-top: 0;
                color: #333;
            }
            .feature-card p {
                color: #666;
                margin-bottom: 1rem;
            }
            .feature-button {
                background: #667eea;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 5px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
            }
            .feature-button:hover {
                background: #5a6fd8;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Company Calendar Dashboard</h1>
            <div class="user-info">
                <span>Welcome, ${user.username}</span>
                <button class="logout-button" onclick="logout()">Logout</button>
            </div>
        </div>
        
        <div class="main-content">
            <div class="welcome-card">
                <h2>Welcome to your Calendar Management Dashboard</h2>
                <p>Manage your company events, share calendars, and keep everyone informed about upcoming activities.</p>
            </div>
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h3>Manage Events</h3>
                    <p>Create, edit, and delete company events. Keep your calendar up to date with all important activities.</p>
                    <a href="/events" class="feature-button">Manage Events</a>
                </div>
                
                <div class="feature-card">
                    <h3>Share Calendar</h3>
                    <p>Generate shareable URLs and subscription links for external users to access your company calendar.</p>
                    <a href="/calendar/share" class="feature-button">Share Calendar</a>
                </div>
                
                <div class="feature-card">
                    <h3>Embed Widget</h3>
                    <p>Create embeddable widgets to display your calendar events on your company website.</p>
                    <a href="/widget" class="feature-button">Create Widget</a>
                </div>
            </div>
        </div>

        <script>
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

    res.send(dashboardHtml);
  }

  /**
   * Validate current session
   */
  private validateSession(req: Request, res: Response) {
    const user = req.user!;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        companyId: user.companyId
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}

export const authRoutes = new AuthRoutes();