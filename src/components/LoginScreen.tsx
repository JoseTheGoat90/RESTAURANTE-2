/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Flame,
  UtensilsCrossed,
  Wine,
  Shield,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Floating decorative background culinary badges
const FLOATING_ELEMENTS = [
  { icon: UtensilsCrossed, delay: 0, x: '8%', y: '18%', duration: 8, scale: 0.9 },
  { icon: Flame, delay: 1.5, x: '88%', y: '16%', duration: 9, scale: 1.1 },
  { icon: Wine, delay: 0.8, x: '12%', y: '78%', duration: 10, scale: 1 },
  { icon: Sparkles, delay: 2.2, x: '85%', y: '74%', duration: 7, scale: 0.85 },
  { icon: Layers, delay: 3, x: '92%', y: '45%', duration: 11, scale: 0.8 },
  { icon: Activity, delay: 1.2, x: '6%', y: '48%', duration: 9.5, scale: 0.9 },
];

export const LoginScreen: React.FC = () => {
  const { login, loginDemo, isLoading, loginError } = useAuth();
  const { effectiveTheme, toggleTheme, paletteConfig } = useTheme();

  // Inputs completely empty as requested
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Crear cuenta: el cargo lo asigna la base según la configuración del restaurante
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [avisoRegistro, setAvisoRegistro] = useState<{ ok: boolean; texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (!modoRegistro) {
      await login(email, password);
      return;
    }
    if (password.length < 6) {
      setAvisoRegistro({ ok: false, texto: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setRegistrando(true);
    setAvisoRegistro(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(window.location.origin)}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password, data: { nombre: nombre.trim() } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data.msg || data.error_description || data.message || '');
        setAvisoRegistro({
          ok: false,
          texto: /rate limit/i.test(msg)
            ? 'Se enviaron demasiados correos de confirmación en poco tiempo. Intenta en una hora o pide a administración que te cree la cuenta.'
            : /registered|exists/i.test(msg)
              ? 'Ese correo ya tiene cuenta. Inicia sesión.'
              : /password/i.test(msg)
                ? 'La contraseña es muy débil. Usa al menos 6 caracteres, con letras y números.'
                : msg || `No se pudo crear la cuenta (${res.status}).`,
        });
        return;
      }
      if (data.access_token) {
        await login(email, password); // el proyecto no exige confirmar el correo
        return;
      }
      setAvisoRegistro({ ok: true, texto: `Cuenta creada. Te enviamos un correo a ${email.trim()}: confírmalo y luego inicia sesión aquí.` });
      setModoRegistro(false);
      setPassword('');
    } catch {
      setAvisoRegistro({ ok: false, texto: 'No se pudo conectar con el servidor. Revisa tu conexión.' });
    } finally {
      setRegistrando(false);
    }
  };

  const isDark = effectiveTheme === 'dark';

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden select-none transition-colors duration-500">
      {/* Dynamic Animated Ambient Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.35, 1],
          x: [0, 45, 0],
          y: [0, -50, 0],
          opacity: isDark ? [0.2, 0.35, 0.2] : [0.25, 0.45, 0.25],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-[110px] pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle, #3B82F6 0%, rgba(59, 130, 246, 0) 70%)'
            : 'radial-gradient(circle, #2563EB 0%, rgba(37, 99, 235, 0) 70%)',
        }}
      />

      <motion.div
        animate={{
          scale: [1.2, 0.9, 1.2],
          x: [0, -55, 0],
          y: [0, 40, 0],
          opacity: isDark ? [0.15, 0.28, 0.15] : [0.2, 0.38, 0.2],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-32 -right-32 w-[560px] h-[560px] rounded-full blur-[120px] pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle, #10B981 0%, rgba(16, 185, 129, 0) 70%)'
            : 'radial-gradient(circle, #059669 0%, rgba(5, 150, 105, 0) 70%)',
        }}
      />

      <motion.div
        animate={{
          scale: [0.95, 1.25, 0.95],
          opacity: isDark ? [0.1, 0.2, 0.1] : [0.15, 0.28, 0.15],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle, #6366F1 0%, transparent 70%)'
            : 'radial-gradient(circle, #818CF8 0%, transparent 70%)',
        }}
      />

      {/* Futuristic Geometric Backdrop Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '36px 36px',
        }}
      />

      {/* Floating Animated Culinary Particles & Icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {FLOATING_ELEMENTS.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{
                opacity: isDark ? [0.15, 0.45, 0.15] : [0.25, 0.6, 0.25],
                y: [0, -25, 0],
                rotate: [0, 10, -10, 0],
                scale: [item.scale, item.scale * 1.08, item.scale],
              }}
              transition={{
                duration: item.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: item.delay,
              }}
              className="absolute hidden md:flex items-center justify-center p-3 rounded-2xl backdrop-blur-md border border-[var(--border-soft)] shadow-xl"
              style={{
                left: item.x,
                top: item.y,
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.55)' : 'rgba(255, 255, 255, 0.65)',
                color: paletteConfig.accent,
              }}
            >
              <IconComp className="w-5 h-5 stroke-[2]" />
            </motion.div>
          );
        })}
      </div>

      {/* Top Header Controls: Direct Light/Dark Mode Switcher */}
      <div className="absolute top-5 right-5 z-20">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-soft)] shadow-md hover:border-[var(--brand-accent)] transition-all cursor-pointer backdrop-blur-md"
          title={`Cambiar a ${isDark ? 'Modo Claro' : 'Modo Oscuro'}`}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-600" />
              <span>Modo Oscuro</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Main Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 35, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10 bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-[32px] p-7 sm:p-9 shadow-2xl backdrop-blur-2xl overflow-hidden"
      >
        {/* Subtle glowing card perimeter line */}
        <div
          className="absolute -top-[1px] left-1/4 right-1/4 h-[2px] rounded-full blur-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${paletteConfig.accent}, transparent)`,
          }}
        />

        {/* Brand Header with Custom Luxury Culinary Emblem Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-4">
            {/* Ambient Pulsing Aura Behind Emblem */}
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -inset-2 rounded-3xl blur-md"
              style={{ backgroundColor: paletteConfig.accent }}
            />

            {/* Custom Emblem Logo */}
            <motion.div
              initial={{ scale: 0.7, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 220 }}
              className="relative w-20 h-20 rounded-3xl flex items-center justify-center p-3 shadow-2xl overflow-hidden border border-white/20"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)'
                  : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              }}
            >
              {/* Fine Rotating Orbit Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-1 rounded-2xl border border-white/20 border-dashed pointer-events-none"
              />

              {/* Vector Masterpiece: Stylized Cloche & Golden Flame Crown */}
              <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12 relative z-10 drop-shadow-md">
                <defs>
                  <linearGradient id="gastroGold" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FDE047" />
                    <stop offset="0.5" stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#D97706" />
                  </linearGradient>
                  <linearGradient id="clocheSilver" x1="0" y1="10" x2="64" y2="50" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#CBD5E1" />
                  </linearGradient>
                </defs>

                {/* Cloche Top Handle Knob */}
                <circle cx="32" cy="18" r="3.5" fill="url(#gastroGold)" />
                <path d="M30 18H34V22H30Z" fill="url(#gastroGold)" />

                {/* Luxury Cloche Dome */}
                <path
                  d="M14 42C14 27.5 22 22 32 22C42 22 50 27.5 50 42H14Z"
                  fill="url(#clocheSilver)"
                  fillOpacity="0.95"
                />

                {/* Subtle Plate Rim Base */}
                <rect x="10" y="44" width="44" height="4" rx="2" fill="url(#gastroGold)" />

                {/* Crown Stars / Culinary Sparkles */}
                <path
                  d="M32 10L33.2 13.5L36.8 14.8L33.2 16L32 19.5L30.8 16L27.2 14.8L30.8 13.5Z"
                  fill="#FDE047"
                />
                <circle cx="21" cy="14" r="1.5" fill="#FDE047" />
                <circle cx="43" cy="14" r="1.5" fill="#FDE047" />

                {/* Steam Swirls */}
                <path
                  d="M26 31C28 29 27 27 28 25"
                  stroke="url(#gastroGold)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M36 31C38 29 37 27 38 25"
                  stroke="url(#gastroGold)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Sistema Operativo Gastronómico</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-main)]">
              Panel de Gestión
            </h1>

            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Ingresa tus credenciales para acceder a la administración
            </p>
          </motion.div>
        </div>

        {/* Error Alert with Shake Animation */}
        <AnimatePresence>
          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3 font-semibold shadow-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{loginError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {avisoRegistro && (
          <div className={`mb-5 p-3.5 rounded-2xl text-xs font-semibold leading-snug border ${avisoRegistro.ok ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'}`}>
            {avisoRegistro.texto}
          </div>
        )}

        {/* Clean Login Form - Boxes completely blank initially */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {modoRegistro && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">Nombre</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={registrando}
                className="w-full h-12 px-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-all duration-200"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative group">
              <Mail className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--brand-accent)] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="usuario@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full h-12 pl-10 pr-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-all duration-200 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
              Contraseña
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--brand-accent)] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={modoRegistro ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full h-12 pl-10 pr-11 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-all duration-200 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={isLoading || registrando || !email.trim() || !password}
            style={{ backgroundColor: paletteConfig.accent }}
            className="w-full h-12 mt-2 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading || registrando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{registrando ? 'Creando cuenta...' : 'Validando credenciales...'}</span>
              </>
            ) : (
              <>
                <span>{modoRegistro ? 'Crear cuenta' : 'Iniciar Sesión'}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </motion.button>
        </form>

        <button
          type="button"
          onClick={() => {
            setModoRegistro((m) => !m);
            setAvisoRegistro(null);
          }}
          className="w-full mt-3 text-sm font-bold text-[var(--brand-accent)] hover:underline cursor-pointer"
        >
          {modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Créala aquí'}
        </button>

        <button
          type="button"
          onClick={loginDemo}
          className="w-full h-11 mt-3 rounded-2xl text-sm font-bold text-[var(--text-main)] bg-[var(--bg-card)] border border-dashed border-[var(--border-soft)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          Probar en modo demo (datos de ejemplo)
        </button>

        {/* Security & System Status Badges */}
        <div className="mt-7 pt-5 border-t border-[var(--border-soft)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Acceso Seguro TLS</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Base de Datos Activa</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
