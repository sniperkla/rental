'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';

interface User { id: string; email: string; name: string; role: string; }
interface AuthCtx { user: User | null; login: (email: string, pw: string) => Promise<void>; logout: () => void; loading: boolean; }

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('rental_user');
    const token  = localStorage.getItem('rental_token');
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('rental_token', res.data.access_token);
    localStorage.setItem('rental_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('rental_token');
    localStorage.removeItem('rental_user');
    setUser(null);
    window.location.href = '/login';
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
