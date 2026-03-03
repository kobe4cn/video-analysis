'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, setTokens, logout: storeLogout, hasRole } = useAuthStore();

  const login = async (email: string, password: string) => {
    const data = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; name: string; email: string; role: 'ADMIN' | 'OPERATOR' | 'USER' };
    }>('/auth/login', { email, password });

    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    connectSocket();
    router.push('/dashboard');
  };

  const logout = () => {
    disconnectSocket();
    storeLogout();
    router.push('/login');
  };

  return { user, isAuthenticated, login, logout, hasRole };
}
