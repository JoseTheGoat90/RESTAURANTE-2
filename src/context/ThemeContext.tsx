/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type PaletteId = 'azul' | 'verde' | 'calido';

export interface PaletteConfig {
  id: PaletteId;
  name: string;
  description: string;
  accent: string;
  primaryHex: string;
  accentHover: string;
  accentLight: string;
  badgeBg: string;
  badgeText: string;
}

export const PALETTES: Record<PaletteId, PaletteConfig> = {
  azul: {
    id: 'azul',
    name: 'Azul Confiable',
    description: 'Control, orden y confianza operativa (#0284C7)',
    accent: '#0284C7',
    primaryHex: '#0284C7',
    accentHover: '#0369A1',
    accentLight: 'rgba(2, 132, 199, 0.12)',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeText: '#0284C7',
  },
  verde: {
    id: 'verde',
    name: 'Verde Fresco',
    description: 'Cocina viva, insumos frescos y balance (#0D9488)',
    accent: '#0D9488',
    primaryHex: '#0D9488',
    accentHover: '#0F766E',
    accentLight: 'rgba(13, 148, 136, 0.12)',
    badgeBg: 'rgba(13, 148, 136, 0.15)',
    badgeText: '#0D9488',
  },
  calido: {
    id: 'calido',
    name: 'Cálido Gourmet',
    description: 'Fuego de parrilla y calidez culinaria (#D97706)',
    accent: '#D97706',
    primaryHex: '#D97706',
    accentHover: '#B45309',
    accentLight: 'rgba(217, 119, 6, 0.12)',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    badgeText: '#D97706',
  },
};

export const STATUS_COLORS = {
  nuevo: '#F59E0B',      // Pendiente / Nuevo: Amarillo suave / Naranja claro
  cocina: '#3B82F6',     // En preparación / Cocina: Azul
  listo: '#10B981',      // Listo para servir: Verde vivo
  pagado: '#94A3B8',     // Pagado / Cerrado: Gris neutral
  alerta: '#EF4444',     // Alerta / Cancelar / Eliminar: Rojo suave
};

export interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  currentPalette: PaletteId;
  palette: PaletteId;
  paletteConfig: PaletteConfig;
  setPalette: (p: PaletteId) => void;
  palettes: typeof PALETTES;
  statusColors: typeof STATUS_COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('restaurante_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  const [currentPalette, setPaletteState] = useState<PaletteId>(() => {
    try {
      const saved = localStorage.getItem('restaurante_palette');
      if (saved === 'azul' || saved === 'verde' || saved === 'calido') {
        return saved;
      }
    } catch {}
    return 'azul';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveTheme: 'light' | 'dark' =
    theme === 'auto' ? (systemIsDark ? 'dark' : 'light') : theme;

  const paletteConfig = PALETTES[currentPalette] || PALETTES.azul;

  // Apply CSS Variables to Root Document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--bg-main', '#000000');
      root.style.setProperty('--bg-card', '#121212');
      root.style.setProperty('--text-main', '#F8FAFC');
      root.style.setProperty('--text-muted', '#94A3B8');
      root.style.setProperty('--border-color', '#27272A');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--bg-main', '#F4F6F8');
      root.style.setProperty('--bg-card', '#FFFFFF');
      root.style.setProperty('--text-main', '#1E293B');
      root.style.setProperty('--text-muted', '#64748B');
      root.style.setProperty('--border-color', '#E2E8F0');
    }

    // Set Brand Accent Variables
    root.style.setProperty('--brand-accent', paletteConfig.accent);
    root.style.setProperty('--brand-hover', paletteConfig.accentHover);
    root.style.setProperty('--brand-light', paletteConfig.accentLight);

    // Set Status Colors
    root.style.setProperty('--status-nuevo', STATUS_COLORS.nuevo);
    root.style.setProperty('--status-cocina', STATUS_COLORS.cocina);
    root.style.setProperty('--status-listo', STATUS_COLORS.listo);
    root.style.setProperty('--status-pagado', STATUS_COLORS.pagado);
    root.style.setProperty('--status-alerta', STATUS_COLORS.alerta);
  }, [effectiveTheme, paletteConfig]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem('restaurante_theme_mode', mode);
    } catch {}
  };

  const setPalette = (p: PaletteId) => {
    setPaletteState(p);
    try {
      localStorage.setItem('restaurante_palette', p);
    } catch {}
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        effectiveTheme,
        setTheme,
        currentPalette,
        palette: currentPalette,
        paletteConfig,
        setPalette,
        palettes: PALETTES,
        statusColors: STATUS_COLORS,
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
