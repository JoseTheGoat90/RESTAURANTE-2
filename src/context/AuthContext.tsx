/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AuthSession } from '../types.ts';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';

const STORAGE_KEY = 'restaurante_auth_session';
const REFRESH_MARGIN_MS = 60_000;

interface AuthContextType {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  loginError: string | null;
  login: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  loginDemo: () => void;
  logout: () => void;
  getValidAccessToken: () => Promise<string>;
  handleAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s.isDemo) return s;
    // Una sesión real sin refresh token válido no se puede renovar
    if (!s.accessToken || !s.refreshToken) return null;
    return s;
  } catch {
    return null;
  }
}

async function fetchToken(body: Record<string, string>, grant: 'password' | 'refresh_token') {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function toSession(data: any, fallbackEmail: string): AuthSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    userEmail: data.user?.email || fallbackEmail,
  };
}

/** Comprueba en la base que el correo esté en usuarios_autorizados. */
async function checkAutorizado(accessToken: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/es_autorizado`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const refreshing = useRef<Promise<string> | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const saveSession = (sess: AuthSession | null) => {
    setSession(sess);
    sessionRef.current = sess;
    try {
      if (sess) localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const logout = useCallback(() => {
    const current = sessionRef.current;
    if (current && !current.isDemo) {
      fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.accessToken}` },
      }).catch(() => {});
    }
    saveSession(null);
    setLoginError(null);
  }, []);

  const handleAuthError = useCallback(() => {
    if (sessionRef.current?.isDemo) return;
    saveSession(null);
    setLoginError('Tu sesión expiró o ya no tienes acceso. Inicia sesión de nuevo.');
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setLoginError(null);
    const cleanEmail = email.toLowerCase().trim();
    const fail = (msg: string) => {
      setLoginError(msg);
      return { ok: false, error: msg };
    };
    try {
      if (!cleanEmail || !pass) return fail('Escribe tu correo y tu contraseña.');
      const res = await fetchToken({ email: cleanEmail, password: pass }, 'password');
      if (!res.ok) return fail('Correo o contraseña incorrectos.');
      const newSession = toSession(await res.json(), cleanEmail);
      if (!(await checkAutorizado(newSession.accessToken))) {
        return fail('Acceso denegado: este usuario no está autorizado en este restaurante.');
      }
      saveSession(newSession);
      return { ok: true };
    } catch {
      return fail('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = () => {
    setLoginError(null);
    saveSession({
      accessToken: '',
      refreshToken: '',
      expiresAt: Number.MAX_SAFE_INTEGER,
      userEmail: 'demo',
      isDemo: true,
    });
  };

  /** Devuelve un token vigente, renovándolo si está por vencer. */
  const getValidAccessToken = useCallback(async (): Promise<string> => {
    const current = sessionRef.current;
    if (!current || current.isDemo) return '';
    if (current.expiresAt - Date.now() > REFRESH_MARGIN_MS) return current.accessToken;
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      try {
        const res = await fetchToken({ refresh_token: current.refreshToken }, 'refresh_token');
        if (!res.ok) throw new Error('refresh');
        const renewed = toSession(await res.json(), current.userEmail);
        saveSession(renewed);
        return renewed.accessToken;
      } catch {
        handleAuthError();
        return '';
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [handleAuthError]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session),
        isDemo: Boolean(session?.isDemo),
        isLoading,
        loginError,
        login,
        loginDemo,
        logout,
        getValidAccessToken,
        handleAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
