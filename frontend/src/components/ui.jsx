import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useApi';
import { AYUDA, ROLES } from '../lib/roles';
import { colorDia } from '../lib/format';

const ICONOS = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  ruta: 'M3 11l19-9-9 19-2-8-8-2z',
  carrito: 'M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6 M8 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M19 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  porcentaje: 'M19 5L5 19 M7 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M17 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
  caja: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  camion: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M15.5 18.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  devolver: 'M1 4v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  billete: 'M2 7h20v10H2z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M6 12h.01 M18 12h.01',
  etiqueta: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  ubicacion: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  barras: 'M18 20V10 M12 20V4 M6 20v-6',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  check: 'M20 6L9 17l-5-5',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  cerrar: 'M18 6L6 18 M6 6l12 12',
  mas: 'M12 5v14 M5 12h14',
  menos: 'M5 12h14',
  alerta: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  descarga: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
};

export function Icono({ nombre, size = 20, className = '' }) {
  return (
    <svg className={`icono ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[nombre] || ''} />
    </svg>
  );
}

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="110" fill="#B5451D" />
      <circle cx="256" cy="266" r="150" fill="#F4C98B" />
      <circle cx="200" cy="220" r="18" fill="#6B3A1F" />
      <circle cx="300" cy="235" r="14" fill="#6B3A1F" />
      <circle cx="230" cy="300" r="16" fill="#6B3A1F" />
      <circle cx="310" cy="310" r="12" fill="#6B3A1F" />
      <circle cx="265" cy="190" r="10" fill="#6B3A1F" />
    </svg>
  );
}

// Cabecera de cada pantalla: rol, ayuda contextual, título y acciones.
export function Encabezado({ path, titulo, subtitulo, children }) {
  const { usuario } = useAuth();
  const ayuda = AYUDA[path] && AYUDA[path][usuario.rol];
  return (
    <>
      {ayuda && (
        <div className="ayuda">
          <span className="ayuda__rol">{ROLES[usuario.rol].nombre}</span>
          <div>
            <div className="ayuda__titulo">Qué haces en esta pantalla</div>
            <div>{ayuda}</div>
          </div>
        </div>
      )}
      <div className="encabezado">
        <div>
          <h1>{titulo}</h1>
          {subtitulo && <p className="muted">{subtitulo}</p>}
        </div>
        {children && <div className="encabezado__acciones">{children}</div>}
      </div>
    </>
  );
}

export function Tarjeta({ titulo, subtitulo, children, className = '', acciones }) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || acciones) && (
        <div className="tarjeta__cab">
          <div>
            {titulo && <h3>{titulo}</h3>}
            {subtitulo && <p className="muted pequeno">{subtitulo}</p>}
          </div>
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ etiqueta, valor, sub, tono = 'info' }) {
  return (
    <div className="kpi">
      <div className="kpi__etiqueta">{etiqueta}</div>
      <div className="kpi__valor">{valor}</div>
      {sub && <span className={`chip chip--${tono}`}>{sub}</span>}
    </div>
  );
}

export const Chip = ({ tono = 'neutro', children }) => <span className={`chip chip--${tono}`}>{children}</span>;

export function Aviso({ tono = 'info', children }) {
  return <div className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export const Cargando = ({ texto = 'Cargando…' }) => <p className="muted cargando">{texto}</p>;

export function EstadoCarga({ estado, children }) {
  if (estado.error && !estado.data) return <Aviso tono="error">{estado.error.message}</Aviso>;
  if (!estado.data) return <Cargando />;
  return children(estado.data);
}

export function SelectorModulo({ moduloId, setModuloId, modulos, conTodos = false, label = 'Módulo' }) {
  return (
    <label className="campo campo--inline">
      <span>{label}</span>
      <select value={moduloId} onChange={(e) => setModuloId(e.target.value)}>
        {conTodos && <option value="">Todos los módulos</option>}
        {modulos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
    </label>
  );
}

export function Segmentado({ opciones, valor, onChange, etiqueta }) {
  return (
    <div className="segmentado" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => onChange(o.valor)}>{o.texto}</button>
      ))}
    </div>
  );
}

export function Contador({ valor, onChange, max = 999, etiqueta }) {
  return (
    <div className="contador">
      <button type="button" aria-label={`Quitar uno ${etiqueta || ''}`} onClick={() => onChange(Math.max(0, valor - 1))} disabled={valor <= 0}>
        <Icono nombre="menos" size={16} />
      </button>
      <input type="number" inputMode="numeric" min="0" max={max} value={valor} aria-label={etiqueta}
        onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0)))} />
      <button type="button" aria-label={`Agregar uno ${etiqueta || ''}`} onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max}>
        <Icono nombre="mas" size={16} />
      </button>
    </div>
  );
}

// Barra de lotes por día de antigüedad (de más antiguo a más nuevo).
export function BarraLotes({ lotes, limite, escala }) {
  const total = lotes.reduce((a, l) => a + l.cantidad, 0);
  const base = escala || total || 1;
  return (
    <div className="barra-lotes" role="img" aria-label={lotes.map((l) => `Día ${l.dia}: ${l.cantidad} unidades`).join(', ') || 'Sin stock'}>
      {lotes.map((l, i) => (
        <div key={i} className="barra-lotes__tramo" title={`Día ${l.dia}: ${l.cantidad} unidades`}
          style={{ width: `${(l.cantidad / base) * 100}%`, background: colorDia(l.dia, limite) }}>
          {l.cantidad}
        </div>
      ))}
    </div>
  );
}

export function LeyendaDias() {
  return (
    <div className="leyenda">
      <span><i style={{ background: 'var(--dia-nuevo)' }} />Día 1 (nuevo)</span>
      <span><i style={{ background: 'var(--dia-medio)' }} />Días intermedios</span>
      <span><i style={{ background: 'var(--dia-limite)' }} />Límite alcanzado: devolver</span>
    </div>
  );
}

export function Tabla({ columnas, filas, vacio = 'Sin datos.', claveFila = (f, i) => f.id ?? i }) {
  if (!filas || !filas.length) return <p className="muted vacio">{vacio}</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>{columnas.map((c) => <th key={c.titulo} className={c.num ? 'num' : ''}>{c.titulo}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={claveFila(f, i)}>
              {columnas.map((c) => <td key={c.titulo} className={c.num ? 'num' : ''}>{c.render ? c.render(f) : f[c.campo]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const EnlaceBoton = ({ to, children, variante = 'primario' }) => <Link className={`boton boton--${variante}`} to={to}>{children}</Link>;
