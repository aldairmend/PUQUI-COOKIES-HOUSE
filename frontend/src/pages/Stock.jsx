import { useState } from 'react';
import { useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { colorDia, fecha, turnoNombre } from '../lib/format';
import { BarraLotes, Chip, Encabezado, EstadoCarga, LeyendaDias, SelectorModulo, Tabla, Tarjeta } from '../components/ui';

export default function Stock() {
  const mod = useModulo();
  const [saborFiltro, setSaborFiltro] = useState('');
  const q = mod.moduloId ? `?modulo_id=${mod.moduloId}` : null;
  const stock = useFetch(q && `/stock${q}`);
  const historial = useFetch(q && `/stock/historial${q}&dias=7${saborFiltro ? `&sabor_id=${saborFiltro}` : ''}`);

  return (
    <>
      <Encabezado path="/stock" titulo="Stock por sabor y día"
        subtitulo="Composición actual de cada sabor por día de antigüedad. El lote más antiguo es el que se vende primero (FIFO); al llegar al día límite se devuelve.">
        {!mod.fijo && <SelectorModulo {...mod} />}
      </Encabezado>
      <EstadoCarga estado={stock}>
        {(d) => {
          const productos = [...new Set(d.grupos.map((g) => g.producto))];
          return (
            <>
              <LeyendaDias />
              {productos.map((prod) => (
                <Tarjeta key={prod} className="bloque" titulo={prod}
                  acciones={<span className="muted pequeno">se devuelve al llegar al Día {d.grupos.find((g) => g.producto === prod).dias_limite_venta}</span>}>
                  <div className="rejilla rejilla--3" style={{ marginBottom: 0 }}>
                    {d.grupos.filter((g) => g.producto === prod).map((g) => (
                      <div className="sabor-card" key={g.sabor_id}>
                        <div className="sabor-card__cab">
                          <h3>{g.sabor}</h3>
                          <span className="negrita">{g.total} uds</span>
                        </div>
                        <BarraLotes limite={g.dias_limite_venta} lotes={g.lotes.map((l) => ({ dia: l.dia, cantidad: l.cantidad_actual }))} />
                        <div style={{ marginTop: 8 }}>
                          {g.lotes.length === 0 && <p className="muted pequeno">Sin stock.</p>}
                          {g.lotes.map((l) => (
                            <div className="lote-linea" key={l.lote_id}>
                              <span><i className="punto" style={{ background: colorDia(l.dia, l.dia_limite) }} />Día {l.dia} · {l.cantidad_actual} uds</span>
                              <span className="muted">recibido {fecha(l.fecha_recepcion)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {g.sale_primero && <Chip tono="aviso">Sale primero: Día {g.sale_primero.dia} ({g.sale_primero.cantidad})</Chip>}
                          {g.por_devolver > 0 && <Chip tono="error">Devolver {g.por_devolver}</Chip>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
              ))}
              <div style={{ height: 20 }} />
              <Tarjeta titulo="Historial de rotación (últimos 7 días)"
                subtitulo="Reconstruye de qué día salió cada galleta vendida, por turno: algo que la hojita física no permite."
                acciones={(
                  <label className="campo campo--inline">
                    <span>Sabor</span>
                    <select value={saborFiltro} onChange={(e) => setSaborFiltro(e.target.value)}>
                      <option value="">Todos</option>
                      {d.grupos.map((g) => <option key={g.sabor_id} value={g.sabor_id}>{g.producto} · {g.sabor}</option>)}
                    </select>
                  </label>
                )}>
                <EstadoCarga estado={historial}>
                  {(h) => (
                    <Tabla filas={h} claveFila={(f, i) => i} vacio="Sin movimientos para ese sabor todavía." columnas={[
                      { titulo: 'Fecha', render: (f) => fecha(f.fecha) },
                      { titulo: 'Turno', render: (f) => turnoNombre(f.turno) },
                      { titulo: 'Producto', campo: 'producto' },
                      { titulo: 'Sabor', campo: 'sabor' },
                      { titulo: 'Día al vender', render: (f) => <Chip tono={f.dia_al_vender === 1 ? 'exito' : 'info'}>Día {f.dia_al_vender}</Chip> },
                      { titulo: 'Cantidad', num: true, campo: 'cantidad' },
                    ]} />
                  )}
                </EstadoCarga>
              </Tarjeta>
            </>
          );
        }}
      </EstadoCarga>
    </>
  );
}
