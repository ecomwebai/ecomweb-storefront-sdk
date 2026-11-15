"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { CurrentIdentity } from "@ecomweb/sdk";
import { useStoreData } from "../store/store-context";
import { storeApiPath } from "../store-scope";

interface AuthError {
  message: string;
  code?: string;
}

interface AuthContextType {
  user: CurrentIdentity | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: AuthError | null }>;
  sendLoginCode: (email: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (
    email: string,
    code: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: (nextPath?: string) => Promise<{ error: AuthError | null }>;
  signInAnonymously: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useStoreData();
  const storeRef = store.ref;
  const [user, setUser] = useState<CurrentIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const base = storeApiPath(storeRef, "auth");

  /** Tokens live in httpOnly cookies, so identity comes from the server. */
  const loadUser = useCallback(async () => {
    try {
      const res = await fetch(storeApiPath(storeRef, "auth/session"), {
        cache: "no-store",
      });
      setUser(res.ok ? ((await res.json()).identity ?? null) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [storeRef]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const post = useCallback(
    async (
      action: string,
      body?: unknown
    ): Promise<{ error: AuthError | null }> => {
      const res = await fetch(`${base}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        return { error: payload?.error ?? { message: "Request failed" } };
      }

      return { error: null };
    },
    [base]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await post("login", { email, password });
      if (!result.error) await loadUser();
      return result;
    },
    [post, loadUser]
  );

  const signUp = useCallback(
    async (email: string, password: string, name?: string) =>
      // Registration deliberately does not log the caller in. An anonymous
      // identity being upgraded is identified server-side from the session
      // cookie (lib/auth/route-handlers.ts), never from anything sent here.
      post("register", { email, password, name }),
    [post]
  );

  const sendLoginCode = useCallback(
    async (email: string) => post("otp/request", { email }),
    [post]
  );

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      const result = await post("otp/verify", { email, code });
      if (!result.error) await loadUser();
      return result;
    },
    [post, loadUser]
  );

  const signInWithGoogle = useCallback(
    async (nextPath?: string) => {
      const res = await fetch(
        `${base}/google/url?redirect_to=${encodeURIComponent(nextPath || "/")}`
      );

      if (!res.ok) return { error: { message: "Google sign-in unavailable" } };

      const { url } = await res.json();
      window.location.href = url;
      return { error: null };
    },
    [base]
  );

  const signInAnonymously = useCallback(async () => {
    const result = await post("anonymous");
    if (!result.error) await loadUser();
    return result;
  }, [post, loadUser]);

  const signOut = useCallback(async () => {
    await post("logout");
    setUser(null);
  }, [post]);

  const value: AuthContextType = {
    user,
    loading,
    isAnonymous: user?.is_anonymous ?? false,
    signIn,
    signUp,
    sendLoginCode,
    verifyOtp,
    signInWithGoogle,
    signInAnonymously,
    signOut,
    refresh: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
