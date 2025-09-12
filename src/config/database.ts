// Database table names and configuration
export const DATABASE_TABLES = {
  USERS: 'users',
  COMPANIES: 'companies',
  EVENTS: 'events',
} as const;

// Database configuration and connection settings
export const DATABASE_CONFIG = {
  // Connection pool settings
  maxConnections: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  
  // Query settings
  queryTimeout: 10000,
  
  // Cache settings
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes in milliseconds
} as const;