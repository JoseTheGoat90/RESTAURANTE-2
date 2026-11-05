/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme, PaletteId } from '../context/ThemeContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Sun, Moon, Laptop, RefreshCw, ChefHat, Palette, Check } from 'lucide-react';

export const Header: React.FC = () => {
  const { session } = useAuth();
  const { theme, setTheme, currentPalette, setPalette, palettes, paletteConfig } = useTheme();
  const { loadAllData, isRefreshing } = useData();
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);

  const cycleTheme = () => {
    if (theme === 'auto') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('auto');
  };

  const getThemeIcon = () => {
    if (theme === 'auto') return <Laptop className="w-4 h-4 text-gray-500" />;
    if (theme === 'light') return <Sun className="w-4 h-4 text-amber-500" />;
    return <Moon className="w-4 h-4 text-sky-400" />;
  };

  const getThemeLabel = () => {
    if (theme === 'auto') return 'Auto';
    if (theme === 'light') return 'Claro';
    return 'Oscuro';
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-card)] text-[var(--text-main)] border-b border-gray-200 dark:border-zinc-800 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-colors duration-200"
            style={{ backgroundColor: paletteConfig.accent }}
          >
            <ChefHat className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[var(--text-main)] tracking-tight truncate">
                Restaurante <span className="font-normal opacity-50">·</span> Panel de gestión
              </h1>
              <span
                className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: paletteConfig.accentLight,
                  color: paletteConfig.accent,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: paletteConfig.accent }}
                />
                {paletteConfig.name}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate hidden sm:block">
              Ventas, inventario en tiempo real, comandas y proyecciones
            </p>
          </div>
        </div>

        {/* User Info & Actions Zone */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Palette Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPaletteMenu(!showPaletteMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 transition-all cursor-pointer"
              title="Cambiar paleta de colores"
              aria-label="Cambiar paleta de colores"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: paletteConfig.accent }} />
              <span className="hidden sm:inline text-xs">{paletteConfig.name}</span>
            </button>

            {showPaletteMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPaletteMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--bg-card)] border border-gray-200 dark:border-zinc-800 shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Paletas de Interfaz
                  </div>
                  {(Object.keys(palettes) as PaletteId[]).map((pKey) => {
                    const p = palettes[pKey];
                    const isSelected = currentPalette === pKey;
                    return (
                      <button
                        key={pKey}
                        onClick={() => {
                          setPalette(pKey);
                          setShowPaletteMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-gray-100 dark:bg-zinc-800 font-bold text-[var(--text-main)]'
                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: p.accent }}
                          />
                          <div className="truncate">
                            <span className="block truncate font-medium">{p.name}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 shrink-0" style={{ color: p.accent }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Quick Refresh Data */}
          <button
            onClick={() => loadAllData()}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Sincronizar base de datos"
            aria-label="Sincronizar base de datos"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              style={isRefreshing ? { color: paletteConfig.accent } : undefined}
            />
          </button>

          {/* Theme Switcher (Claro / Oscuro puro negro) */}
          <button
            onClick={cycleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
            title={`Modo de visualización: ${getThemeLabel()}`}
            aria-label="Cambiar tema de color"
          >
            {getThemeIcon()}
            <span className="hidden sm:inline">{getThemeLabel()}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
