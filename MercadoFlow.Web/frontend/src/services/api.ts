import axios from 'axios';

// In production, use relative URL (proxied by nginx)
// In development, use localhost
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const API_BASE_URL = isDevelopment
  ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001')
  : ''; // Empty string means relative URLs in production

const TOKEN_KEY = 'mercadoflow_token';
const REFRESH_TOKEN_KEY = 'mercadoflow_refresh_token';
const USER_KEY = 'mercadoflow_user';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending/receiving httpOnly cookies
});

// Request interceptor - no longer needed for token as it's in httpOnly cookie
// But keep for backwards compatibility during transition
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
