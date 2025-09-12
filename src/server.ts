import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRoutes } from './api/routes/auth';
import { eventRoutes } from './api/routes/events';
import { calendarRoutes } from './api/routes/calendar';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/', authRoutes.getRouter());
app.use('/', eventRoutes.getRouter());
app.use('/', calendarRoutes.getRouter());

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/login');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Page Not Found</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            a { color: #667eea; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/login">Go to Login</a>
    </body>
    </html>
  `);
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export { app };

// Start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Company Calendar Platform server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
  });
}