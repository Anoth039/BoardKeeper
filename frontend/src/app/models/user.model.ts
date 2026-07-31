export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}