import api from './api';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ConfirmResetPasswordRequest,
  User,
} from '../types';

const TOKEN_KEY = 'mercadoflow_token';
const REFRESH_TOKEN_KEY = 'mercadoflow_refresh_token';
const USER_KEY = 'mercadoflow_user';

export const authService = {
  // Login
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<{success: boolean; data: AuthResponse}>('/api/v1/auth/login', credentials);
    const authData = response.data.data; // API returns {success: true, data: {...}}
    if (authData) {
      this.setTokens(authData.token, authData.refreshToken);
      this.setUser(authData.user);
    }
    return authData;
  },

  // Register
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<{success: boolean; data: AuthResponse}>('/api/v1/auth/register', data);
    const authData = response.data.data; // API returns {success: true, data: {...}}
    if (authData) {
      this.setTokens(authData.token, authData.refreshToken);
      this.setUser(authData.user);
    }
    return authData;
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      this.clearAuth();
    }
  },

  // Refresh Token
  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post<{success: boolean; data: AuthResponse}>('/api/v1/auth/refresh', {
      refreshToken,
    } as RefreshTokenRequest);

    const authData = response.data.data; // API returns {success: true, data: {...}}
    if (authData) {
      this.setTokens(authData.token, authData.refreshToken);
      this.setUser(authData.user);
    }

    return authData;
  },

  // Change Password
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.put('/api/v1/auth/change-password', data);
  },

  // Request Password Reset
  async requestPasswordReset(data: ResetPasswordRequest): Promise<void> {
    await api.post('/api/v1/auth/reset-password', data);
  },

  // Confirm Password Reset
  async confirmPasswordReset(data: ConfirmResetPasswordRequest): Promise<void> {
    await api.post('/api/v1/auth/reset-password/confirm', data);
  },

  // Get Current User
  async getCurrentUser(): Promise<User> {
    const response = await api.get<{success: boolean; data: User}>('/api/v1/auth/me');
    const userData = response.data.data; // API returns {success: true, data: {...}}
    if (userData) {
      this.setUser(userData);
    }
    return userData;
  },

  // Token Management
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(token: string, refreshToken: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  // User Management
  getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  clearAuth(): void {
    this.clearTokens();
    this.clearUser();
  },

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export default authService;
