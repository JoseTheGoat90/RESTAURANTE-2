/**
 * Foto del comprobante Nequi / transferencia al cobrar. La foto queda en un bucket privado,
 * unida a la venta. La base rechaza una referencia ya usada (captura vieja) y avisa si el monto
 * no coincide con la cuenta.
 */
import React, { useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { formatCOP } from '../utils/formatters.ts';
import { useOperacion } from '../services/operacion.ts';

export interface ComprobantePendiente {
  ventaId: string;
  total: number;
  metodo: string;
  descripcion: string;
}

export const METODOS_CON_COMPROBANTE = ['nequi', 'transferencia'];

export const ComprobanteModal: React.FC<{ pendiente: ComprobantePendiente; onCerrar: () => void }> = ({ pendiente, onCerrar }) => {
  const { showNotification } = useData();
  const { adjuntarComprobante } = useOperacion();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [monto, setMonto] = useState<string>(String(pendiente.total));
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);

  const elegir = (f: File | undefined) => {
    if (!f) return;
    setArchivo(f);
    setVista(URL.createObjectURL(f));
  };

  const guardar = async () => {
    if (!archivo) return;
    setGuardando(true);
    try {
      const m = Number(monto.replace(/[.\s$]/g, '').replace(',', '.'));
      const res = await adjuntarComprobante({
        ventaId: pendiente.ventaId,
        archivo,
        metodo: pendiente.metodo,
        monto: Number.isFinite(m) && m > 0 ? m : null,
        referencia: referencia.trim(),
      });
      showNotification(res);
      if (res.ok) onCerrar();
    } catch (e) {
      showNotification({ ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo guardar el comprobante.' });
    } finally {
      setGuardando(false);
    }
  };

  const montoNum = Number(monto.replace(/[.\s$]/g, '').replace(',', '.'));
  const noCoincide = monto !== '' && Number.isFinite(montoNum) && Math.abs(montoNum - pendiente.total) >= 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[var(--bg-card)] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">Comprobante {pendiente.metodo === 'nequi' ? 'Nequi' : 'de transferencia'}</h3>
            <p className="text-xs text-[var(--text-muted)]">{pendiente.descripcion} · {formatCOP(pendiente.total)}</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block cursor-pointer">
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
          {vista ? (
            <img src={vista} alt="Comprobante" className="w-full max-h-72 object-contain rounded-2xl border border-[var(--border-soft)] bg-black/5" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-[var(--border-soft)] hover:bg-black/5 dark:hover:bg-white/5">
              <Camera className="w-10 h-10 text-[var(--brand-accent)]" />
              <span className="font-bold">Tomar foto o elegir captura</span>
            </div>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Monto del comprobante</span>
            <input
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border-2 bg-transparent font-bold ${noCoincide ? 'border-amber-500' : 'border-[var(--border-soft)]'}`}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Referencia (opcional)</span>
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="M1234567"
              className="w-full px-3 py-2.5 rounded-xl border-2 border-[var(--border-soft)] bg-transparent font-bold uppercase"
            />
          </label>
        </div>
        {noCoincide && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            El monto no coincide con la cuenta ({formatCOP(pendiente.total)}). Se guardará marcado para revisión.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onCerrar} className="py-3 rounded-2xl border-2 border-[var(--border-soft)] font-bold cursor-pointer">
            Después
          </button>
          <button
            type="button"
            disabled={!archivo || guardando}
            onClick={() => void guardar()}
            className="py-3 rounded-2xl bg-[var(--brand-accent)] text-white font-extrabold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar foto
          </button>
        </div>
      </div>
    </div>
  );
};
