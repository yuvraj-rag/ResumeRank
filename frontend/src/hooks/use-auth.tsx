"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signInWithPassword: (
    email: string,
    pass: string
  ) => Promise<{ error: Error | null }>;
  signUpWithPassword: (
    email: string,
    pass: string
  ) => Promise<{ error: Error | null; data?: { user: User | null; session: Session | null } }>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: isSupabaseConfigured,
  isConfigured: false,
  signInWithPassword: async () => ({
    error: new Error("Supabase is not configured"),
  }),
  signUpWithPassword: async () => ({
    error: new Error("Supabase is not configured"),
  }),
  signOut: async () => {},
  getToken: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let isMounted = true;

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Error getting initial session:", error);
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to initialize auth session:", err);
        setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!supabase) return undefined;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return undefined;

      // If token is expiring within 60 seconds or already expired, refresh it proactively
      const expiresAt = data.session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now() + 60_000) {
        const { data: refreshed, error: refreshError } =
          await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          setSession(refreshed.session);
          setUser(refreshed.session.user ?? null);
          return refreshed.session.access_token;
        }
      }

      return data.session.access_token;
    } catch {
      return undefined;
    }
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, pass: string) => {
      if (!supabase) {
        return { error: new Error("Authentication is not configured") };
      }
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });
        if (error) return { error };
        return { error: null };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err : new Error("Failed to sign in"),
        };
      }
    },
    []
  );

  const signUpWithPassword = useCallback(
    async (email: string, pass: string) => {
      if (!supabase) {
        return { error: new Error("Authentication is not configured") };
      }
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pass,
        });
        if (error) return { error };
        return { error: null, data };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err : new Error("Failed to sign up"),
        };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    }
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      getToken,
    }),
    [
      user,
      session,
      isLoading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      getToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
