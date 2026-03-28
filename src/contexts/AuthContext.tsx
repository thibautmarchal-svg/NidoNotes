import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Teacher } from '../types';
import { authApi } from '../lib/api';
import { syncAll as doSyncAll } from '../lib/sync';
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
    // Vérifier la session côté serveur au chargement
    authApi.me()
      .then(u => {
        setUser(u);
        localStorage.setItem('nido_user', JSON.stringify(u));
        // Sync données en arrière-plan
        doSyncAll().catch(() => {});
      })
      .catch(() => {
        // Offline ou session expirée
        const stored = localStorage.getItem('nido_user');
        if (!stored) {
          setUser(null);
          localStorage.removeItem('nido_user');
        }
        // Sinon on garde l'user du localStorage (mode offline)
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await authApi.login(email, password);
    setUser(u);
    localStorage.setItem('nido_user', JSON.stringify(u));
    doSyncAll().catch(() => {});
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
    localStorage.removeItem('nido_last_sync');
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

