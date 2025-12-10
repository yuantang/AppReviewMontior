
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { Session, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
   isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  loginWithDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only set session if we actually got one from a real provider
      if (session) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id, session);
      } else {
        setLoading(false);
      }
    }).catch(() => {
        // Handle error (e.g. placeholder url connection error)
        setLoading(false);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, currentSession?: Session | null) => {
    try {
      const token = currentSession?.access_token || session?.access_token;
      if (!token) {
        console.warn('No access token available to fetch profile');
        setLoading(false);
        return;
      }

      // Preferred: service endpoint (avoids RLS recursion issues)
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } });

      if (res.ok) {
        const { profile: profileFromApi } = await res.json();
        if (profileFromApi) {
          setProfile(profileFromApi as UserProfile);
          return;
        }
      } else if (res.status !== 404) {
        console.warn('Profile endpoint failed', await res.text());
      }

      // Fallback: direct select only if configured, swallow recursion errors
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (!error && data) {
          setProfile(data as UserProfile);
          return;
        }

        if (error && !`${error.message}`.toLowerCase().includes('infinite recursion')) {
          console.warn('Could not fetch profile via client', error);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const loginWithDemo = () => {
      const demoUser: User = {
          id: 'demo-admin-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'admin@demo.com',
          email_confirmed_at: new Date().toISOString(),
          phone: '',
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
      };

      const demoSession: Session = {
          access_token: 'demo-token',
          refresh_token: 'demo-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: demoUser
      };

      setSession(demoSession);
      setUser(demoUser);
      setProfile({ id: 'demo-admin-id', email: 'admin@demo.com', role: 'admin' });
      setLoading(false);
  };

  const value = {
    session,
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'superadmin',
    isSuperAdmin: profile?.role === 'superadmin',
    signOut,
    loginWithDemo
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
