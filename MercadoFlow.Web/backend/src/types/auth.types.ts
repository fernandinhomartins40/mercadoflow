import { UserRole } from '@prisma/client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserInfo;
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  marketId?: string;
  industryId?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  marketId?: string;
  industryId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  marketId?: string;
  industryId?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Request extension for authenticated routes
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}