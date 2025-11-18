export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  marketId?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MARKET_OWNER = 'MARKET_OWNER',
  MARKET_MANAGER = 'MARKET_MANAGER',
  INDUSTRY_USER = 'INDUSTRY_USER',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  marketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
}
