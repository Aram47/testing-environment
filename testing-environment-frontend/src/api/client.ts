import axios, { AxiosInstance } from 'axios';
import { tokenStorage } from '../lib/tokenStorage';

class ApiClient {
  readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: import.meta.env.VITE_API_URL ?? '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Add JWT token to all requests
    this.http.interceptors.request.use((config) => {
      const token = tokenStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: Handle 401 Unauthorized errors
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          tokenStorage.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
}

export const apiClient = new ApiClient().http;
