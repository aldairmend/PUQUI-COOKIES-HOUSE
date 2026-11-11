import { useState } from 'react';
import { useFetch } from '../hooks/useApi';
import { soles } from '../lib/format';
import { EnlaceBoton, Encabezado, EstadoCarga, Kpi, Segmentado, Tabla, Tarjeta } from '../components/ui';
import { Variacion } from './Dashboard';

const PERIODOS = [{ valor: 'semana', texto: '7 días' }, { valor: 'mes', texto: '30 días' }];

export default function PanelPropietario() {
  const [periodo, setPeriodo] = useState('mes');
  const estado = useFetch(`/dashboard/propietario?periodo=${periodo}`);

  return (
    <>
      <Encabezado path="/panel" titulo="Panel del propietario"
        subtitulo="Cómo va el negocio en los 5 módulos: ventas, mermas, diferencias de caja y efecto de las promociones.">
        <Segmentado etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onChange={setPeriodo} />
      </Encabezado>
      <EstadoCarga estado={estado}>
        {(d) => (
          <>
            <div className="rejilla rejilla--kpi">
              <div className="kpi">
                <div className="kpi__etiqueta">Ventas</div>
                <div className="kpi__valor">{soles(d.kpis.ventas)}</div>
                <Variacion valor={d.kpis.ventas_variacion} compara={d.kpis.compara} />
              </div>
              <Kpi etiqueta="Mermas (devoluciones)" valor={`${d.kpis.devueltas} uds`} sub={`${soles(d.kpis.merma_valor)} a precio de lista`} tono="error" />
              <Kpi etiqueta="Descuadre de caja" valor={soles(d.kpis.descuadre)} sub={`${d.kpis.cierres_descuadrados} cierres con diferencia`} tono={d.kpis.descuadre === 0 ? 'exito' : 'aviso'} />
              <Kpi etiqueta="Descuentos por promociones" valor={soles(d.kpis.descuentos)} sub="Lo que el cliente ahorró" />
            </div>

            <div className="rejilla rejilla--2">
              <Tarjeta titulo="Ventas, mermas y caja por módulo" subtitulo="Para comparar los módulos entre sí en el mismo periodo.">
                <Tabla filas={d.modulos} columnas={[
                  { titulo: 'Módulo', render: (m) => <strong>{m.nombre}</strong> },
                  { titulo: 'Ventas', num: true, render: (m) => soles(m.ventas) },
                  { titulo: 'Devueltas', num: true, render: (m) => `${m.devueltas} uds` },
                  { titulo: '% merma', num: true, render: (m) => `${m.pct_merma.toFixed(1)}%` },
                  { titulo: 'Descuadre de caja', num: true, render: (m) => <span style={{ color: m.descuadre ? 'var(--error)' : 'var(--exito)', fontWeight: 700 }}>{soles(m.descuadre)}</span> },
                ]} />
              </Tarjeta>
              <Tarjeta titulo="Para decidir" subtitulo="Sugerencias armadas con los datos reales del periodo.">
                <ul className="vinetas">{d.sugerencias.map((s) => <li key={s}>{s}</li>)}</ul>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <EnlaceBoton to="/reportes" variante="secundario">Ver reportes</EnlaceBoton>
                  <EnlaceBoton to="/promociones" variante="secundario">Editar promociones</EnlaceBoton>
                </div>
              </Tarjeta>
            </div>

            <div className="rejilla rejilla--mitad">
              <Tarjeta titulo="Rendimiento de las promociones" subtitulo="Cuántas veces se usó cada una y cuánto descuento dio."
                acciones={<EnlaceBoton to="/aplicador" variante="secundario">Probar en el Aplicador</EnlaceBoton>}>
                <ul className="lista-simple">
                  {d.promociones.map((p) => (
                    <li key={p.id}>
                      <span><strong>{p.nombre}</strong>{!p.activo && <span className="muted"> (desactivada)</span>}<br /><span className="muted pequeno">{p.usos} usos en el periodo</span></span>
                      <strong>{soles(p.descuento)}</strong>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
              <Tarjeta titulo="Sabores que más se devuelven" subtitulo="Unidades que llegaron a su día límite sin venderse.">
                {d.sabores_devueltos.length === 0 && <p className="muted">Sin devoluciones en el periodo.</p>}
                <ul className="lista-simple">
                  {d.sabores_devueltos.map((s) => (
                    <li key={s.producto + s.sabor}><span><strong>{s.sabor}</strong> <span className="muted">· {s.producto}</span></span><strong>{s.unidades} uds</strong></li>
                  ))}
                </ul>
              </Tarjeta>
            </div>
          </>
        )}
      </EstadoCarga>
    </>
  );
}
