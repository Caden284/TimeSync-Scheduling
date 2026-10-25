'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, UserProfile } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, profile: null, loading: true,
  login: async () => null, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(result => {
      if (result) { setUser(result.session); setProfile(result.profile); }
      setLoading(false);
    });
    // Keep state in sync when the session ends elsewhere (other tab, expiry).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const result = await signIn(email, password);
    if (result) { setUser(result.session); setProfile(result.profile); }
    return result?.profile ?? null;
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
