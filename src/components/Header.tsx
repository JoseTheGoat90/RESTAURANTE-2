/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Sun, Moon, RefreshCw, ChefHat, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { session, logout, isDemo } = useAuth();
  const { effectiveTheme, toggleTheme, paletteConfig } = useTheme();
  const { loadAllData, isRefreshing, lastError } = useData();

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-header)] text-[var(--text-main)] border-b border-[var(--border-soft)] transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-colors duration-200 relative overflow-hidden"
            style={{ backgroundColor: paletteConfig.accent }}
          >
            <svg viewBox="0 0 64 64" fill="none" className="w-6 h-6">
              <circle cx="32" cy="18" r="3" fill="#FDE047" />
              <path d="M14 42C14 27.5 22 22 32 22C42 22 50 27.5 50 42H14Z" fill="#FFFFFF" fillOpacity="0.95" />
              <rect x="11" y="44" width="42" height="4" rx="2" fill="#FDE047" />
              <path d="M32 10L33 13.5L36.5 14.5L33 15.5L32 19L31 15.5L27.5 14.5L31 13.5Z" fill="#FDE047" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-[var(--text-main)] tracking-tight truncate">
              Restaurante <span className="font-normal opacity-50">·</span> Panel de gestión
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] truncate hidden sm:block">
              Ventas, inventario en tiempo real, gastos y reportes operativos
            </p>
          </div>
        </div>

        {/* User Info & Actions Zone */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Refresh Data */}
          <button
            onClick={() => loadAllData()}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--border-soft)] transition-colors cursor-pointer disabled:opacity-50"
            title="Sincronizar base de datos"
            aria-label="Sincronizar base de datos"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              style={isRefreshing ? { color: paletteConfig.accent } : undefined}
            />
          </button>

          {/* Theme Switcher: Exclusively Claro (#F4F5F7) / Oscuro (#000000) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--border-soft)] transition-all cursor-pointer shadow-2xs"
            title={`Cambiar a ${effectiveTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}`}
            aria-label="Cambiar tema claro / oscuro"
          >
            {effectiveTheme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Oscuro</span>
              </>
            )}
          </button>

          {/* User & Logout Button */}
          {session && (
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              title={isDemo ? "Salir del modo demo" : `Cerrar sesión (${session.userEmail})`}
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
      {isDemo && (
        <div className="bg-amber-400 text-amber-950 text-center text-xs sm:text-sm font-black py-1.5 px-4">
          MODO DEMO · Datos de ejemplo guardados solo en este navegador. Nada se envía a la base de datos.
        </div>
      )}
      {!isDemo && lastError && (
        <div role="alert" className="bg-rose-600 text-white text-center text-xs sm:text-sm font-bold py-1.5 px-4">
          {lastError}
        </div>
      )}
    </header>
  );
};
