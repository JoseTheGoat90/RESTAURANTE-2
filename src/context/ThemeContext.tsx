/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  accent: string;
  primaryHex: string;
  accentHover: string;
  accentLight: string;
}

export interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  paletteConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('restaurante_theme_mode');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return 'light'; // Default to light mode per specification
  });

  const effectiveTheme: 'light' | 'dark' = theme;

  const paletteConfig: ThemeConfig = {
    accent: effectiveTheme === 'dark' ? '#3B82F6' : '#2563EB',
    primaryHex: effectiveTheme === 'dark' ? '#3B82F6' : '#2563EB',
    accentHover: effectiveTheme === 'dark' ? '#60A5FA' : '#1D4ED8',
    accentLight: effectiveTheme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.12)',
  };

  // Apply CSS Variables to Root Document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      // Modo Oscuro (Totalmente Negro)
      root.style.setProperty('--bg-main', '#000000');
      root.style.setProperty('--bg-card', '#121212');
      root.style.setProperty('--bg-card-alt', '#18181B');
      root.style.setProperty('--bg-header', '#09090B');
      root.style.setProperty('--text-main', '#F8FAFC');
      root.style.setProperty('--text-muted', '#A1A1AA');
      root.style.setProperty('--border-soft', '#27272A');
      root.style.setProperty('--border-color', '#27272A');

      root.style.setProperty('--brand-accent', '#3B82F6');
      root.style.setProperty('--brand-hover', '#60A5FA');
      root.style.setProperty('--brand-light', 'rgba(59, 130, 246, 0.15)');

      root.style.setProperty('--metric-positive', '#34D399');
      root.style.setProperty('--metric-negative', '#F87171');
    } else {
      root.classList.remove('dark');
      // Modo Claro (Gris muy claro)
      root.style.setProperty('--bg-main', '#F4F5F7');
      root.style.setProperty('--bg-card', '#FFFFFF');
      root.style.setProperty('--bg-header', '#EBEEF2');
      root.style.setProperty('--text-main', '#0F172A');
      root.style.setProperty('--text-muted', '#64748B');
      root.style.setProperty('--border-soft', '#E2E8F0');
      root.style.setProperty('--border-color', '#E2E8F0');

      root.style.setProperty('--brand-accent', '#2563EB');
      root.style.setProperty('--brand-hover', '#1D4ED8');
      root.style.setProperty('--brand-light', 'rgba(37, 99, 235, 0.12)');

      root.style.setProperty('--metric-positive', '#10B981');
      root.style.setProperty('--metric-negative', '#EF4444');
    }

    // Traffic light / comanda status
    root.style.setProperty('--status-nuevo', '#F59E0B');
    root.style.setProperty('--status-cocina', effectiveTheme === 'dark' ? '#3B82F6' : '#2563EB');
    root.style.setProperty('--status-listo', effectiveTheme === 'dark' ? '#34D399' : '#10B981');
    root.style.setProperty('--status-pagado', effectiveTheme === 'dark' ? '#A1A1AA' : '#64748B');
    root.style.setProperty('--status-alerta', effectiveTheme === 'dark' ? '#F87171' : '#EF4444');
  }, [effectiveTheme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem('restaurante_theme_mode', mode);
    } catch {}
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        effectiveTheme,
        setTheme,
        toggleTheme,
        paletteConfig,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
