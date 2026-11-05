/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a number to Colombian Peso (COP) with no decimals using es-CO locale.
 */
export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$ 0';
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Returns the current date in America/Bogota formatted as 'YYYY-MM-DD'.
 */
export function getBogotaTodayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string or Date object in America/Bogota timezone.
 */
export function formatBogotaDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a date string in America/Bogota timezone as date-only (e.g. "3 nov 2026").
 */
export function formatBogotaDateOnly(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    // If it's a YYYY-MM-DD string without time, parse safely
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, d] = dateInput.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(dateObj);
    }

    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Capitalizes the first letter of a string and keeps the rest intact.
 */
export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Normalizes user typed text: ensures first letter is capitalized immediately
 * and eliminates duplicate spaces without disrupting live typing.
 */
export function normalizeUserInput(str: string): string {
  if (!str) return '';
  // Collapse double/multiple spaces
  const cleaned = str.replace(/ {2,}/g, ' ');
  // Find first letter character and capitalize it
  const match = cleaned.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/);
  if (!match || match.index === undefined) return cleaned;
  
  const idx = match.index;
  return (
    cleaned.slice(0, idx) +
    cleaned.charAt(idx).toUpperCase() +
    cleaned.slice(idx + 1)
  );
}

/**
 * Generates an operation ID using Bogotá time:
 * V-AAAAMMDD-HHMMSS-XXXX for sales
 * G-AAAAMMDD-HHMMSS-XXXX for expenses
 */
export function generateOperationId(type: 'V' | 'G'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const getPart = (pType: string) => parts.find((p) => p.type === pType)?.value || '00';

  const yyyy = getPart('year');
  const mm = getPart('month');
  const dd = getPart('day');
  let hh = getPart('hour');
  if (hh === '24') hh = '00';
  const min = getPart('minute');
  const ss = getPart('second');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${type}-${yyyy}${mm}${dd}-${hh}${min}${ss}-${rand}`;
}

/**
 * Converts user-input quantity to the base unit of the ingredient.
 * Base units in DB: 'g' (gramos), 'kg' (kilogramos), 'lb' (libras), 'unidad' (unidades).
 * Conversion factors:
 * 1 kg = 1000 g
 * 1 lb = 453.592 g
 */
export function convertToBaseUnit(
  amount: number,
  inputUnit: 'g' | 'kg' | 'lb' | 'unidad',
  baseUnit: string
): number {
  const cleanBaseUnit = baseUnit.toLowerCase().trim();

  // If base unit is unit/unidades
  if (cleanBaseUnit === 'unidad' || cleanBaseUnit === 'unidades') {
    return amount;
  }

  // First convert inputUnit to grams
  let grams = amount;
  if (inputUnit === 'kg') {
    grams = amount * 1000;
  } else if (inputUnit === 'lb') {
    grams = amount * 453.592;
  } else if (inputUnit === 'g') {
    grams = amount;
  }

  // Convert grams to target base unit
  if (cleanBaseUnit === 'g' || cleanBaseUnit === 'gramos') {
    return Math.round(grams * 1000) / 1000;
  } else if (cleanBaseUnit === 'kg' || cleanBaseUnit === 'kilogramos') {
    return Math.round((grams / 1000) * 1000) / 1000;
  } else if (cleanBaseUnit === 'lb' || cleanBaseUnit === 'libras') {
    return Math.round((grams / 453.592) * 1000) / 1000;
  }

  return amount;
}

/**
 * Formats stock amount with unit for clean display
 */
export function formatStock(stock: number, unit: string): string {
  const cleanUnit = unit.toLowerCase().trim();
  const formattedNumber = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 2,
  }).format(stock);

  if (cleanUnit === 'unidad' || cleanUnit === 'unidades') {
    return `${formattedNumber} unid.`;
  }
  return `${formattedNumber} ${cleanUnit}`;
}

/**
 * Strips all asterisk symbols (** or *) from assistant text to ensure clean, professional output
 * as strictly requested by the user.
 */
export function cleanAsterisks(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/\*/g, '');
}
