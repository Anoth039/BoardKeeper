export interface AuthUser {
  id: number;
  email: string;
  role: string;
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
}