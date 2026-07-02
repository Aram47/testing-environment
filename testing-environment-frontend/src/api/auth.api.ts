import { apiClient } from './client';
import type { User } from '../types';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthCredentials {
  firstName: string;
  lastName: string;
  companyName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

class AuthApi {
  async login(input: AuthCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
    return data;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
    return data;
  }

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  }
}

export const authApi = new AuthApi();
