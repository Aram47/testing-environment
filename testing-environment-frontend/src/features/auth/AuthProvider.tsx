import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { authApi, type AuthCredentials, type RegisterInput } from '../../api/auth.api';
import { tokenStorage } from '../../lib/tokenStorage';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = Boolean(tokenStorage.getToken());
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: hasToken,
  });

  const login = useCallback(
    async (input: AuthCredentials) => {
      const response = await authApi.login(input);
      tokenStorage.setToken(response.accessToken);
      await refetch();
    },
    [refetch],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await authApi.register(input);
      tokenStorage.setToken(response.accessToken);
      await refetch();
    },
    [refetch],
  );

  const logout = useCallback(() => {
    tokenStorage.clearToken();
    window.location.assign('/login');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user || tokenStorage.getToken()),
      login,
      register,
      logout,
    }),
    [isLoading, login, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
