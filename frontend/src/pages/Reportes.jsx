import { useState } from 'react';
import { useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { descargarCSV, fecha, hoyISO, medioNombre, motivoNombre, soles, sumarDiasISO, turnoNombre } from '../lib/format';
import { Encabezado, EstadoCarga, Icono, Kpi, SelectorModulo, Tabla, Tarjeta } from '../components/ui';
import { ColorDesajuste } from './Caja';

function BotonCSV({ onClick }) {
  return <button type="button" className="boton boton--secundario boton--chico" onClick={onClick}><Icono nombre="descarga" size={16} /> CSV</button>;
}

export default function Reportes() {
  const mod = useModulo({ conTodos: true });
  const [desde, setDesde] = useState(() => sumarDiasISO(hoyISO(), -6));
  const [hasta, setHasta] = useState(hoyISO);
  const q = `?desde=${desde}&hasta=${hasta}${mod.moduloId ? `&modulo_id=${mod.moduloId}` : ''}`;
  const medios = useFetch(`/reportes/ventas-por-medio-pago${q}`);
  const productos = useFetch(`/reportes/ventas-por-producto${q}`);
  const devol = useFetch(`/reportes/devoluciones${q}`);
  const caja = useFetch(`/reportes/caja${q}`);
  const sufijo = `${desde}_a_${hasta}`;

  return (
    <>
      <Encabezado path="/reportes" titulo="Reportes" subtitulo="Consolidados del negocio para todos los módulos o uno elegido.">
        <label className="campo campo--inline"><span>Desde</span><input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="campo campo--inline"><span>Hasta</span><input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <SelectorModulo {...mod} conTodos />
      </Encabezado>

      <div className="rejilla rejilla--mitad">
        <Tarjeta titulo="Ventas por medio de pago"
          acciones={medios.data && <BotonCSV onClick={() => descargarCSV(`ventas-por-medio-${sufijo}.csv`, medios.data, [
            { titulo: 'Medio', valor: (r) => medioNombre(r.medio) }, { titulo: 'Ventas', valor: (r) => r.ventas }, { titulo: 'Monto', valor: (r) => r.monto },
          ])} />}>
          <EstadoCarga estado={medios}>
            {(ms) => {
              const total = ms.reduce((a, m) => a + Number(m.monto), 0);
              return (
                <>
                  <Tabla filas={ms} claveFila={(m) => m.medio} vacio="Sin ventas en el rango." columnas={[
                    { titulo: 'Medio', render: (m) => medioNombre(m.medio) },
                    { titulo: 'Ventas', num: true, campo: 'ventas' },
                    { titulo: 'Monto', num: true, render: (m) => soles(m.monto) },
                    { titulo: '%', num: true, render: (m) => `${total ? Math.round((m.monto / total) * 100) : 0}%` },
                  ]} />
                  <div className="totales" style={{ marginTop: 10 }}><div className="total"><span>Total</span><span>{soles(total)}</span></div></div>
                </>
              );
            }}
          </EstadoCarga>
        </Tarjeta>

        <Tarjeta titulo="Devoluciones por sabor"
          acciones={devol.data && <BotonCSV onClick={() => descargarCSV(`devoluciones-${sufijo}.csv`, devol.data, [
            { titulo: 'Producto', valor: (r) => r.producto }, { titulo: 'Sabor', valor: (r) => r.sabor }, { titulo: 'Motivo', valor: (r) => motivoNombre(r.motivo) },
            { titulo: 'Unidades', valor: (r) => r.unidades }, { titulo: 'Valor a precio de lista', valor: (r) => r.valor },
          ])} />}>
          <EstadoCarga estado={devol}>
            {(ds) => (
              <Tabla filas={ds} claveFila={(d, i) => i} vacio="Sin devoluciones en el rango." columnas={[
                { titulo: 'Producto · sabor', render: (d) => `${d.producto} · ${d.sabor}` },
                { titulo: 'Motivo', render: (d) => motivoNombre(d.motivo) },
                { titulo: 'Unidades', num: true, campo: 'unidades' },
                { titulo: 'Valor', num: true, render: (d) => soles(d.valor) },
              ]} />
            )}
          </EstadoCarga>
        </Tarjeta>
      </div>

      <Tarjeta className="bloque" titulo="Ventas por producto y sabor"
        acciones={productos.data && <BotonCSV onClick={() => descargarCSV(`ventas-por-producto-${sufijo}.csv`, productos.data, [
          { titulo: 'Producto', valor: (r) => r.producto }, { titulo: 'Sabor', valor: (r) => r.sabor }, { titulo: 'Unidades', valor: (r) => r.unidades },
          { titulo: 'Monto', valor: (r) => r.monto }, { titulo: 'Descuento', valor: (r) => r.descuento },
        ])} />}>
        <EstadoCarga estado={productos}>
          {(ps) => (
            <Tabla filas={ps} claveFila={(p) => p.producto + p.sabor} vacio="Sin ventas en el rango." columnas={[
              { titulo: 'Producto', campo: 'producto' },
              { titulo: 'Sabor', render: (p) => <strong>{p.sabor}</strong> },
              { titulo: 'Unidades', num: true, campo: 'unidades' },
              { titulo: 'Descuento', num: true, render: (p) => soles(p.descuento) },
              { titulo: 'Monto', num: true, render: (p) => <strong>{soles(p.monto)}</strong> },
            ]} />
          )}
        </EstadoCarga>
      </Tarjeta>

      <Tarjeta titulo="Resumen de caja"
        acciones={caja.data && <BotonCSV onClick={() => descargarCSV(`caja-${sufijo}.csv`, caja.data.turnos, [
          { titulo: 'Fecha', valor: (r) => r.fecha }, { titulo: 'Turno', valor: (r) => turnoNombre(r.tipo) }, { titulo: 'Módulo', valor: (r) => r.modulo },
          { titulo: 'Usuario', valor: (r) => r.usuario }, { titulo: 'Ventas', valor: (r) => r.ventas_total }, { titulo: 'Esperado', valor: (r) => r.efectivo_esperado },
          { titulo: 'Contado', valor: (r) => r.efectivo_cierre }, { titulo: 'Desajuste', valor: (r) => r.desajuste },
        ])} />}>
        <EstadoCarga estado={caja}>
          {(c) => (
            <>
              <div className="rejilla rejilla--kpi">
                <Kpi etiqueta="Turnos cerrados" valor={c.resumen.cerrados} sub={`${c.resumen.turnos} en el rango`} />
                <Kpi etiqueta="Cuadraron" valor={c.resumen.cuadrados} tono="exito" sub="Sin diferencia" />
                <Kpi etiqueta="Con faltante / sobrante" valor={`${c.resumen.faltantes} / ${c.resumen.sobrantes}`} tono="aviso" sub="Cierres con diferencia" />
                <Kpi etiqueta="Desajuste acumulado" valor={soles(c.resumen.desajuste_total)} tono={c.resumen.desajuste_total ? 'error' : 'exito'} sub="Contado − esperado" />
              </div>
              <Tabla filas={c.turnos.filter((t) => t.hora_cierre && Number(t.desajuste) !== 0)} vacio="Todos los cierres del rango cuadraron."
                columnas={[
                  { titulo: 'Fecha', render: (t) => fecha(t.fecha) },
                  { titulo: 'Turno', render: (t) => turnoNombre(t.tipo) },
                  { titulo: 'Módulo', campo: 'modulo' },
                  { titulo: 'Cerró', campo: 'usuario' },
                  { titulo: 'Esperado', num: true, render: (t) => soles(t.efectivo_esperado) },
                  { titulo: 'Contado', num: true, render: (t) => soles(t.efectivo_cierre) },
                  { titulo: 'Desajuste', num: true, render: (t) => <ColorDesajuste valor={t.desajuste} /> },
                ]} />
              <p className="muted pequeno" style={{ marginTop: 8 }}>La tabla muestra solo los cierres con diferencia; el CSV incluye todos los turnos.</p>
            </>
          )}
        </EstadoCarga>
      </Tarjeta>
    </>
  );
}
