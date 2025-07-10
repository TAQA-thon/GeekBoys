// API Configuration
const config = {
  // Backend API URL - change this to match your Django server
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  
  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 30000,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Pagination settings
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
};

export default config; 