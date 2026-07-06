import type { User } from '../types';
import { generatedApi } from './generated-client';
import type { LoginDto, RegisterDto } from '../generated/api';

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
    return generatedApi.AuthController_login({ path: {} }, input as LoginDto) as Promise<AuthResponse>;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    return generatedApi.AuthController_register({ path: {} }, input as RegisterDto) as Promise<AuthResponse>;
  }

  async me(): Promise<User> {
    return generatedApi.AuthController_me({ path: {} }) as Promise<User>;
  }
}

export const authApi = new AuthApi();
