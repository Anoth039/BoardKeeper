export type Role = 'staff' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  permissions: string[];
}

export interface RegisterResponse {
  message: string;
  isApproved: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface SystemUser {
  id: number;
  email: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}