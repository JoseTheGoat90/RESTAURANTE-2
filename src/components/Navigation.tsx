/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  Boxes,
  BarChart3,
  Bot,
} from 'lucide-react';

export type TabId = 'resumen' | 'vender' | 'gastos' | 'inventario' | 'reporte' | 'asistente';
export type TabType = TabId;

interface NavigationProps {
  activeTab: TabId;
  onSelectTab?: (tab: TabId) => void;
  setActiveTab?: (tab: TabId) => void;
  alertCount?: number;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  setActiveTab,
  alertCount = 0,
}) => {
  const handleSelect = (tab: TabId) => {
    if (onSelectTab) onSelectTab(tab);
    if (setActiveTab) setActiveTab(tab);
  };

  const items: NavItem[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'vender', label: 'Vender', icon: UtensilsCrossed },
    { id: 'gastos', label: 'Gastos', icon: Receipt },
    { id: 'inventario', label: 'Inventario', icon: Boxes, badge: alertCount },
    { id: 'reporte', label: 'Reportes', icon: BarChart3 },
    { id: 'asistente', label: 'Asistente', icon: Bot },
  ];

  return (
    <>
      {/* Desktop / Tablet Top Tabs Bar */}
      <nav className="hidden sm:block bg-[var(--bg-card)] border-b border-gray-200 dark:border-zinc-800 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--brand-light)] text-[var(--brand-accent)] font-bold shadow-xs'
                      : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--brand-accent)]' : 'text-gray-400 dark:text-zinc-500'}`} />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white leading-none animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--brand-accent)] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Fixed Bottom Nav Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)]/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 transition-colors pb-safe">
        <div className="grid grid-cols-6 items-center h-16 px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 px-0.5 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--brand-accent)] font-bold'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-stone-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 px-1 text-[9px] font-bold rounded-full bg-rose-600 text-white leading-none min-w-[14px] text-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-5 h-0.5 bg-[var(--brand-accent)] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
