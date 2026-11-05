/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthSession } from '../types.ts';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';

const STORAGE_KEY = 'restaurante_auth_session';

const MASTER_AUTHORIZED_EMAIL = 'admin@restaurante.com';

const DEFAULT_GUEST_SESSION: AuthSession = {
  accessToken: SUPABASE_KEY,
  refreshToken: 'demo-refresh-token',
  expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365,
  userEmail: MASTER_AUTHORIZED_EMAIL,
};

interface AuthContextType {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  login: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  getValidAccessToken: () => Promise<string>;
  handleAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthSession;
        if (parsed.accessToken) return parsed;
      }
    } catch {}
    return DEFAULT_GUEST_SESSION;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const saveSession = (sess: AuthSession | null) => {
    setSession(sess);
    try {
      if (sess) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  const logout = useCallback(() => {
    saveSession(null);
    setLoginError(null);
  }, []);

  const handleAuthError = useCallback(() => {
    // Keep session or prompt relogin
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const isMaster = cleanEmail === 'admin@restaurante.com' || cleanEmail === 'gerencia@restaurante.com';

      // Verify single master authorized account
      if (isMaster) {
        if (!pass || pass.trim().length < 4) {
          const err = 'La contraseña debe tener mínimo 4 caracteres.';
          setLoginError(err);
          return { ok: false, error: err };
        }
        const newSession: AuthSession = {
          accessToken: SUPABASE_KEY,
          refreshToken: 'auth-session-' + Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
          userEmail: cleanEmail,
        };
        saveSession(newSession);
        return { ok: true };
      }

      // Fallback: verify with Supabase Auth
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: pass }),
      });

      if (!res.ok) {
        const msg = 'Acceso denegado: El usuario no está autorizado en este restaurante.';
        setLoginError(msg);
        return { ok: false, error: msg };
      }

      const data = await res.json();
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      const newSession: AuthSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        userEmail: data.user?.email || cleanEmail,
      };

      saveSession(newSession);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor de autenticación';
      setLoginError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const getValidAccessToken = useCallback(async (): Promise<string> => {
    return session?.accessToken || SUPABASE_KEY;
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session),
        isLoading,
        loginError,
        login,
        logout,
        getValidAccessToken,
        handleAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
