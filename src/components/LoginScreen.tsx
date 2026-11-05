/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  ChefHat,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  ArrowRight,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MASTER_EMAIL = 'admin@restaurante.com';
const MASTER_PASS = '1234';

export const LoginScreen: React.FC = () => {
  const { login, isLoading, loginError } = useAuth();
  const { effectiveTheme, toggleTheme, paletteConfig } = useTheme();

  const [email, setEmail] = useState(MASTER_EMAIL);
  const [password, setPassword] = useState(MASTER_PASS);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    await login(email, password);
  };

  const handleFillMaster = () => {
    setEmail(MASTER_EMAIL);
    setPassword(MASTER_PASS);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden transition-colors duration-300">
      {/* Dynamic Animated Ambient Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          x: [0, 30, 0],
          y: [0, -40, 0],
          opacity: [0.15, 0.28, 0.15],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{
          background: effectiveTheme === 'dark'
            ? 'radial-gradient(circle, #3B82F6 0%, transparent 70%)'
            : 'radial-gradient(circle, #2563EB 0%, transparent 70%)',
        }}
      />
      <motion.div
        animate={{
          scale: [1.2, 0.95, 1.2],
          x: [0, -35, 0],
          y: [0, 45, 0],
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{
          background: effectiveTheme === 'dark'
            ? 'radial-gradient(circle, #34D399 0%, transparent 70%)'
            : 'radial-gradient(circle, #10B981 0%, transparent 70%)',
        }}
      />

      {/* Top Controls: Exclusively Theme Switcher (☀️ Claro #F4F5F7 / 🌙 Oscuro #000000) */}
      <div className="absolute top-4 right-4 z-20">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-soft)] shadow-sm hover:opacity-90 transition-all cursor-pointer"
          title={`Cambiar a ${effectiveTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}`}
        >
          {effectiveTheme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>☀️ Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-600" />
              <span>🌙 Modo Oscuro</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Main Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10 bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Brand Header with Animated Glow Badge */}
        <div className="flex flex-col items-center text-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg relative group"
            style={{ backgroundColor: paletteConfig.accent }}
          >
            <ChefHat className="w-7 h-7 stroke-[2.2]" />
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl -z-10 blur-sm opacity-50"
              style={{ backgroundColor: paletteConfig.accent }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text-main)]"
          >
            Restaurante <span className="opacity-40">·</span> Panel de gestión
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)] font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Acceso exclusivo con Cuenta Maestra Autorizada</span>
          </motion.div>
        </div>

        {/* Master Account Info Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-5 p-3.5 rounded-2xl bg-[var(--bg-header)] border border-[var(--border-soft)] flex items-center justify-between gap-3 text-xs"
        >
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Cuenta Maestra Única
            </span>
            <div className="font-bold text-[var(--text-main)] truncate mt-0.5">
              {MASTER_EMAIL}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillMaster}
            className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-[var(--brand-accent)] text-white hover:opacity-95 shadow-sm transition-all cursor-pointer shrink-0"
          >
            Usar Cuenta
          </button>
        </motion.div>

        {/* Error Alert with Shake Animation */}
        <AnimatePresence>
          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{loginError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
              Correo de la cuenta autorizada
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder={MASTER_EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Clave de acceso
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Demo: 1234</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading || !email.trim() || !password}
            style={{ backgroundColor: paletteConfig.accent }}
            className="w-full h-12 mt-2 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando autorización...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Panel de Gestión</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-[var(--border-soft)] text-center space-y-1">
          <p className="text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1">
            <KeyRound className="w-3 h-3 text-amber-500" />
            <span>Panel centralizado para administración, ventas, gastos e inventario</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
