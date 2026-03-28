import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Teacher } from '../types';
import { authApi } from '../lib/api';
import { clearAll } from '../lib/db';

interface AuthContextValue {
  user: Teacher | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Teacher | null>(() => {
    const stored = localStorage.getItem('nido_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(u => {
        setUser(u);
        localStorage.setItem('nido_user', JSON.stringify(u));
      })
      .catch(() => {
        const stored = localStorage.getItem('nido_user');
        if (!stored) {
          setUser(null);
          localStorage.removeItem('nido_user');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await authApi.login(email, password);
    setUser(u);
    localStorage.setItem('nido_user', JSON.stringify(u));
  };

  const register = async (name: string, email: string, password: string) => {
    const u = await authApi.register(name, email, password);
    setUser(u);
    localStorage.setItem('nido_user', JSON.stringify(u));
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    localStorage.removeItem('nido_user');
    localStorage.removeItem('nido_current_class');
    await clearAll();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
