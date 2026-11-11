import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { soles } from '../lib/format';
import {
  BarraLotes, Chip, Encabezado, EstadoCarga, Kpi, LeyendaDias, Segmentado, SelectorModulo, Tabla, Tarjeta,
} from '../components/ui';

const PERIODOS = [{ valor: 'ayer', texto: 'Ayer' }, { valor: 'semana', texto: '7 días' }, { valor: 'mes', texto: '30 días' }];
const COLOR_MEDIO = { efectivo: '#2F6444', tarjeta: '#2F6690', yape: '#7A4EA3' };

export function GraficoBarras({ serie }) {
  const max = Math.max(...serie.map((s) => s.valor), 0);
  return (
    <>
      <div className="grafico" role="img" aria-label={serie.map((s) => `${s.label}: ${soles(s.valor)}`).join(', ')}>
        {serie.map((s) => (
          <div className="grafico__col" key={s.label}>
            <div className="grafico__valor">{Math.round(s.valor)}</div>
            <div className={`grafico__barra ${s.valor === max && max > 0 ? 'grafico__barra--pico' : ''}`}
              style={{ height: `${max > 0 ? (s.valor / max) * 85 : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="grafico__etiquetas">{serie.map((s) => <div key={s.label}>{s.label}</div>)}</div>
    </>
  );
}

export function Variacion({ valor, compara }) {
  if (valor === null || valor === undefined) return <Chip tono="neutro">Sin datos para comparar</Chip>;
  return <Chip tono={valor >= 0 ? 'exito' : 'error'}>{valor >= 0 ? '+' : ''}{valor}% {compara}</Chip>;
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('ayer');
  const mod = useModulo({ conTodos: true });
  const estado = useFetch(`/dashboard/admin?periodo=${periodo}${mod.moduloId ? `&modulo_id=${mod.moduloId}` : ''}`);

  return (
    <>
      <Encabezado path="/dashboard" titulo="Dashboard" subtitulo="Resumen del negocio: ventas, rotación de stock, caja y alertas de los módulos.">
        <Segmentado etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onChange={setPeriodo} />
        <SelectorModulo {...mod} conTodos />
      </Encabezado>
      <EstadoCarga estado={estado}>
        {(d) => {
          const totalMedios = d.medios.reduce((a, m) => a + m.monto, 0);
          const escala = Math.max(1, ...d.stock.grupos.map((g) => g.lotes.reduce((a, l) => a + l.cantidad, 0)));
          return (
            <>
              <div className="rejilla rejilla--kpi">
                <div className="kpi">
                  <div className="kpi__etiqueta">Ventas</div>
                  <div className="kpi__valor">{soles(d.kpis.ventas)}</div>
                  <Variacion valor={d.kpis.ventas_variacion} compara={d.kpis.compara} />
                </div>
                <Kpi etiqueta="Unidades vendidas" valor={d.kpis.unidades} sub={`${d.kpis.num_ventas} ventas`} />
                <Kpi etiqueta="Precio medio por unidad" valor={soles(d.kpis.precio_medio)} sub="Antes de promociones" />
                <Kpi etiqueta="Por devolver ahora" valor={`${d.kpis.por_devolver} uds`}
                  sub={`${d.kpis.lotes_devolver} ${d.kpis.lotes_devolver === 1 ? 'lote' : 'lotes'} en su día límite`}
                  tono={d.kpis.por_devolver > 0 ? 'error' : 'exito'} />
              </div>

              <div className="rejilla rejilla--2">
                <Tarjeta titulo={d.titulo_serie} subtitulo="Monto vendido en soles. La barra más oscura marca el pico.">
                  <GraficoBarras serie={d.serie} />
                </Tarjeta>
                <Tarjeta titulo="Ventas por medio de pago">
                  {d.medios.map((m) => (
                    <div className="medio" key={m.medio}>
                      <div className="medio__fila"><span style={{ textTransform: 'capitalize' }}>{m.medio}</span><span>{soles(m.monto)}</span></div>
                      <div className="medio__barra"><div style={{ width: `${totalMedios ? (m.monto / totalMedios) * 100 : 0}%`, background: COLOR_MEDIO[m.medio] }} /></div>
                      <div className="muted pequeno">{totalMedios ? Math.round((m.monto / totalMedios) * 100) : 0}% del total · {m.ventas} ventas</div>
                    </div>
                  ))}
                </Tarjeta>
              </div>

              <div className="rejilla rejilla--2">
                <Tarjeta titulo={`Stock por sabor y día · ${d.stock.modulo || ''}`} subtitulo="El número dentro de cada tramo son las unidades de ese día. Reemplaza la hojita física.">
                  <LeyendaDias />
                  {d.stock.grupos.length === 0 && <p className="muted">Sin stock en este módulo.</p>}
                  {d.stock.grupos.map((g) => (
                    <div className="fila-stock" key={g.producto + g.sabor}>
                      <div><strong>{g.sabor}</strong> <span className="muted">· {g.producto}</span></div>
                      <BarraLotes lotes={g.lotes} limite={g.limite} escala={escala} />
                      <div className="fila-stock__total">{g.lotes.reduce((a, l) => a + l.cantidad, 0)}</div>
                    </div>
                  ))}
                  <Link to="/stock" className="pequeno">Ver el stock completo →</Link>
                </Tarjeta>
                <Tarjeta titulo="Alertas">
                  {d.alertas.length === 0 && <p className="muted">Todo en orden: no hay alertas.</p>}
                  {d.alertas.map((a, i) => (
                    <div key={i} className={`alerta alerta--${a.nivel}`}>
                      <div className="alerta__titulo">{a.titulo}</div>
                      <div className="pequeno">{a.texto}</div>
                      <Link to={a.ruta}>{a.accion} →</Link>
                    </div>
                  ))}
                </Tarjeta>
              </div>

              <Tarjeta titulo="Estado de los módulos" subtitulo="Ventas y unidades del periodo elegido; el resto es el estado actual de cada módulo.">
                <Tabla filas={d.modulos} columnas={[
                  { titulo: 'Módulo', render: (m) => <strong>{m.nombre}</strong> },
                  { titulo: 'Ventas', num: true, render: (m) => soles(m.ventas) },
                  { titulo: 'Unidades', num: true, campo: 'unidades' },
                  { titulo: 'Stock vendible', num: true, campo: 'stock' },
                  { titulo: 'Por devolver', num: true, campo: 'por_devolver' },
                  {
                    titulo: 'Desajuste último cierre', num: true,
                    render: (m) => (m.desajuste_ultimo === null ? '—' : <span style={{ color: m.desajuste_ultimo ? 'var(--error)' : 'var(--exito)', fontWeight: 700 }}>{soles(m.desajuste_ultimo)}</span>),
                  },
                  { titulo: 'Estado', render: (m) => <Chip tono={m.estado === 'Sin abrir' ? 'error' : m.estado === 'Turno abierto' ? 'exito' : 'neutro'}>{m.estado}</Chip> },
                ]} />
              </Tarjeta>
            </>
          );
        }}
      </EstadoCarga>
    </>
  );
}
