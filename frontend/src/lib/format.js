// Formatos de montos, fechas y turnos en español y hora de Lima.

export const soles = (n) =>
  `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const turnoNombre = (t) => (t === 'tarde' ? 'Tarde' : t === 'manana' ? 'Mañana' : '—');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Las fechas llegan del servidor como texto en hora de Lima: "2026-11-11 09:32:00.123".
export function fecha(s) {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`;
}
export const hora = (s) => (s ? String(s).slice(11, 16) : '—');
export const fechaHora = (s) => (s ? `${fecha(s)} · ${hora(s)}` : '—');
export function fechaLarga(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return `${DIAS[dt.getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Día de la semana (0 = domingo), hora HH:MM y fecha de ahora mismo en Lima.
export function ahoraLima() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, diaSemana: dias[p.weekday] };
}

export const hoyISO = () => ahoraLima().fecha;
export function sumarDiasISO(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Color del tramo de un lote según su día: Día 1 nuevo, intermedio o en su día límite.
export const colorDia = (dia, limite) => (dia >= limite ? 'var(--dia-limite)' : dia === 1 ? 'var(--dia-nuevo)' : 'var(--dia-medio)');

export const motivoNombre = (m) => ({ limite_dias: 'Límite de días', merma: 'Merma', otro: 'Otro' }[m] || m);
export const medioNombre = (m) => ({ efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape' }[m] || m);

export function descargarCSV(nombre, filas, columnas) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [columnas.map((c) => esc(c.titulo)).join(','), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
