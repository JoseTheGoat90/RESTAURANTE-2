/**
 * Checklists del turno: cada cargo ve solo los suyos; administración ve todos y su cumplimiento.
 * Respuestas grandes de un toque (Sí / No) o un número con rango; fuera de rango = alerta.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock, AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { ChecklistDia, useOperacion } from '../services/operacion.ts';

const NOMBRE_CARGO: Record<string, string> = {
  admin: 'Caja / administración',
  cocina: 'Cocina',
  parrilla: 'Parrilla',
  mesera: 'Salón',
  domicilios: 'Domicilios',
  domiciliario: 'Domiciliario',
};

export const ChecklistsTab: React.FC = () => {
  const { rol } = useAuth();
  const { showNotification } = useData();
  const { checklistsHoy, guardarChecklist } = useOperacion();
  const [lista, setLista] = useState<ChecklistDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<ChecklistDia | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setLista(await checklistsHoy());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los checklists.');
    } finally {
      setCargando(false);
    }
  }, [checklistsHoy]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hechos = lista.filter((c) => c.hecho).length;
  const pct = lista.length ? Math.round((hechos / lista.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-24 sm:pb-8">
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-2 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>{rol === 'admin' ? 'Todos los cargos' : NOMBRE_CARGO[rol ?? ''] ?? 'Mi cargo'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Checklists de hoy</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Queda registrado quién lo hizo y a qué hora. Un "No" o una temperatura fuera de rango cuenta como alerta.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-3xl font-extrabold">{hechos}/{lista.length}</p>
            <p className="text-xs text-[var(--text-muted)]">{pct}% cumplido</p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="p-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm">{error}</p>}
      {cargando && !lista.length && (
        <div className="flex justify-center py-12 text-[var(--text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {!cargando && !error && !lista.length && (
        <p className="text-center text-sm text-[var(--text-muted)] py-12">Tu cargo no tiene checklists asignados.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lista.map((c) => {
          const estado = c.hecho ? (c.alertas > 0 ? 'alerta' : 'ok') : c.vencido ? 'vencido' : 'pendiente';
          const estilo = {
            ok: 'border-emerald-500/40 bg-emerald-500/5',
            alerta: 'border-amber-500/50 bg-amber-500/5',
            vencido: 'border-rose-500/50 bg-rose-500/5',
            pendiente: 'border-[var(--border-soft)] bg-[var(--bg-card)]',
          }[estado];
          return (
            <button
              key={c.id}
              type="button"
              disabled={c.hecho}
              onClick={() => setAbierto(c)}
              className={`text-left rounded-2xl border-2 p-5 transition-all ${estilo} ${c.hecho ? 'cursor-default' : 'hover:scale-[1.01] cursor-pointer'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold">{c.nombre}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {rol === 'admin' && `${NOMBRE_CARGO[c.rol] ?? c.rol} · `}Hora límite {c.hora_limite} · {c.items.length} puntos
                  </p>
                </div>
                {estado === 'ok' && <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />}
                {estado === 'alerta' && <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />}
                {estado === 'vencido' && <Clock className="w-7 h-7 text-rose-500 shrink-0" />}
              </div>
              <p className="mt-3 text-sm font-semibold">
                {c.hecho
                  ? `Hecho a las ${c.hecho_a} por ${c.hecho_por}${c.alertas ? ` · ${c.alertas} alerta(s)` : ''}`
                  : c.vencido
                    ? 'Pasó la hora límite: hazlo ahora'
                    : 'Toca para completarlo'}
              </p>
            </button>
          );
        })}
      </div>

      {abierto && (
        <FormularioChecklist
          checklist={abierto}
          onCerrar={() => setAbierto(null)}
          onGuardar={async (respuestas) => {
            const res = await guardarChecklist(abierto.id, respuestas);
            showNotification(res);
            if (res.ok) {
              setAbierto(null);
              await cargar();
            }
          }}
        />
      )}
    </div>
  );
};

const FormularioChecklist: React.FC<{
  checklist: ChecklistDia;
  onCerrar: () => void;
  onGuardar: (r: Record<string, boolean | number>) => Promise<void>;
}> = ({ checklist, onCerrar, onGuardar }) => {
  const [resp, setResp] = useState<Record<string, boolean | string>>({});
  const [guardando, setGuardando] = useState(false);

  const faltan = checklist.items.filter((i) => i.obligatorio && (resp[i.id] === undefined || resp[i.id] === '')).length;

  const enviar = async () => {
    const limpio: Record<string, boolean | number> = {};
    for (const i of checklist.items) {
      const v = resp[i.id];
      if (v === undefined || v === '') continue;
      limpio[String(i.id)] = i.tipo === 'numero' ? Number(String(v).replace(',', '.')) : (v as boolean);
    }
    setGuardando(true);
    try {
      await onGuardar(limpio);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="bg-[var(--bg-card)] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{checklist.nombre}</h3>
          <button type="button" onClick={onCerrar} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {checklist.items.map((i) => (
          <div key={i.id} className="space-y-2">
            <p className="font-semibold text-sm">
              {i.texto}
              {i.tipo === 'numero' && (i.minimo !== null || i.maximo !== null) && (
                <span className="text-[var(--text-muted)] font-normal"> (entre {i.minimo ?? '—'} y {i.maximo ?? '—'})</span>
              )}
            </p>
            {i.tipo === 'si_no' ? (
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setResp((r) => ({ ...r, [i.id]: v }))}
                    className={`py-4 rounded-2xl text-lg font-extrabold border-2 cursor-pointer transition-colors ${
                      resp[i.id] === v
                        ? v
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-rose-600 border-rose-600 text-white'
                        : 'border-[var(--border-soft)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {v ? 'Sí' : 'No'}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={(resp[i.id] as string) ?? ''}
                onChange={(e) => setResp((r) => ({ ...r, [i.id]: e.target.value }))}
                className="w-full py-3 px-4 rounded-2xl border-2 border-[var(--border-soft)] bg-transparent text-lg font-bold"
                placeholder="Escribe el número"
              />
            )}
          </div>
        ))}

        <button
          type="button"
          disabled={faltan > 0 || guardando}
          onClick={() => void enviar()}
          className="w-full py-4 rounded-2xl bg-[var(--brand-accent)] text-white text-lg font-extrabold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
        >
          {guardando && <Loader2 className="w-5 h-5 animate-spin" />}
          {faltan > 0 ? `Faltan ${faltan} por responder` : 'Guardar checklist'}
        </button>
      </div>
    </div>
  );
};
