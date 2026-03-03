import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'USER';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  initialize: () => void;
  hasRole: (minRole: 'ADMIN' | 'OPERATOR' | 'USER') => boolean;
}

// 角色权限层级：数值越高权限越大
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 3,
  OPERATOR: 2,
  USER: 1,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    set({ user, isAuthenticated: true });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    set({ user: null, isAuthenticated: false });
  },

  initialize: () => {
    if (typeof window === 'undefined') return;
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (userStr && token) {
      try {
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true });
      } catch {
        set({ user: null, isAuthenticated: false });
      }
    }
  },

  // 判断当前用户权限是否 >= 指定的最低角色要求
  hasRole: (minRole) => {
    const user = get().user;
    if (!user) return false;
    return (ROLE_HIERARCHY[user.role] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
  },
}));
