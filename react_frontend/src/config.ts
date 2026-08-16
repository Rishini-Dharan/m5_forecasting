// Support both local development and production environments
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// For WebSocket, replace http with ws (and https with wss)
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 
  (API_BASE_URL.startsWith('https') 
    ? API_BASE_URL.replace('https', 'wss') 
    : API_BASE_URL.replace('http', 'ws'));
