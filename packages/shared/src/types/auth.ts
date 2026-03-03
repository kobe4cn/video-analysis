import type { Role } from '../constants/roles';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
}
