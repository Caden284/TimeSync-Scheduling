'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, UserProfile } from '@/lib/auth';
import type { Models } from 'appwrite';

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, profile: null, loading: true,
  login: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(result => {
      if (result) { setUser(result.session); setProfile(result.profile); }
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const result = await signIn(email, password);
    if (result) { setUser(result.session); setProfile(result.profile); }
  }

  async function logout() {
    await signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
