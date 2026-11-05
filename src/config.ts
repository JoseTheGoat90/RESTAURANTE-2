/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://nqytcqambzznviybguxf.supabase.co';
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string) || 'sb_publishable_Xyql8LJU5Ge81le-DXM3fg_8RN0iJmy';
export const DEFAULT_CHAT_URL = (import.meta.env.VITE_CHAT_URL as string) || 'https://luchofriaz123.app.n8n.cloud/webhook/panel-chat';

export function getChatUrl(): string {
  try {
    const custom = localStorage.getItem('restaurante_n8n_url');
    if (custom && custom.trim().startsWith('http') && !custom.includes('cr7thegoat.app.n8n.cloud')) {
      return custom.trim();
    }
  } catch {}
  return DEFAULT_CHAT_URL;
}

export function setChatUrl(url: string): void {
  try {
    localStorage.setItem('restaurante_n8n_url', url);
  } catch {}
}

export const CHAT_URL = DEFAULT_CHAT_URL;
