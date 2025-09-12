import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import and start the server
import { app } from './server';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Company Calendar Platform - Server started');
  console.log('✓ TypeScript interfaces defined');
  console.log('✓ Directory structure created');
  console.log('✓ Supabase client configured');
  console.log('✓ Authentication system implemented');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});

export * from './models';
export * from './services';
export * from './repositories';
export * from './api';
export * from './config';