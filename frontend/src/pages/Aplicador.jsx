import { useEffect, useState } from 'react';
import { useApi, useFetch } from '../hooks/useApi';
import { DIAS } from '../lib/promo';
import { ahoraLima, soles } from '../lib/format';
import { Aviso, Contador, Encabezado, EstadoCarga, Tabla, Tarjeta } from '../components/ui';

// Casos de prueba rápidos: [nombre, día, hora, [[producto, sabor, cantidad], ...]]
const CASOS = [
  ['3 Flat Cookie (3x2)', 3, '10:00', [['Flat Cookie', 'Chocolate', 3]]],
  ['Happy hour con 3 Flat Cookie', 3, '18:30', [['Flat Cookie', 'Vainilla', 3]]],
  ['Martes con 3 Cookie Cup Nutella', 2, '11:00', [['Cookie Cup', 'Nutella', 3]]],
  ['Venta mixta de S/ 63', 3, '10:00', [['Flat Cookie', 'Chocolate', 3], ['Cookie Cup', 'Chocolate', 2]]],
];

export default function Aplicador() {
  const api = useApi();
  const productos = useFetch('/productos');
  const ahora = ahoraLima();
  const [dia, setDia] = useState(ahora.diaSemana);
  const [horaV, setHoraV] = useState(ahora.hora);
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState({ producto: '', sabor: '', cantidad: 1 });
  const [res, setRes] = useState({ data: null, error: null });

  const ps = productos.data || [];
  const prod = ps.find((p) => String(p.id) === String(sel.producto)) || ps[0];
  useEffect(() => {
    if (prod && !sel.producto) setSel((s) => ({ ...s, producto: prod.id, sabor: prod.sabores[0].id }));
  }, [prod, sel.producto]);

  // Recalcula con la misma regla que usa el cobro en Ventas.
  useEffect(() => {
    if (!items.length) { setRes({ data: null, error: null }); return; }
    let vigente = true;
    api.post('/promociones/simular', {
      dia_semana: dia, hora: horaV,
      items: items.map((i) => ({ producto_id: i.producto_id, sabor_id: i.sabor_id, cantidad: i.cantidad })),
    }).then((data) => vigente && setRes({ data, error: null }), (error) => vigente && setRes({ data: null, error }));
    return () => { vigente = false; };
  }, [api, dia, horaV, items]);

  const etiqueta = (pid, sid) => {
    const p = ps.find((x) => x.id === pid);
    return `${p.nombre} · ${p.sabores.find((s) => s.id === sid).nombre}`;
  };
  function agregar(pid, sid, cantidad) {
    const i = items.findIndex((x) => x.producto_id === pid && x.sabor_id === sid);
    if (i >= 0) setItems(items.map((x, j) => (j === i ? { ...x, cantidad: x.cantidad + cantidad } : x)));
    else setItems([...items, { producto_id: pid, sabor_id: sid, cantidad }]);
  }
  function caso([, d, h, lineas]) {
    setDia(d);
    setHoraV(h);
    setItems(lineas.map(([pn, sn, c]) => {
      const p = ps.find((x) => x.nombre === pn);
      return { producto_id: p.id, sabor_id: p.sabores.find((s) => s.nombre === sn).id, cantidad: c };
    }));
  }

  return (
    <>
      <Encabezado path="/aplicador" titulo="Aplicador de promociones"
        subtitulo="Simula una venta y mira qué promoción aplica el sistema a cada producto. Si más de una aplica, gana la que deja el menor precio. Es la misma regla que se usa al cobrar." />
      <EstadoCarga estado={productos}>
        {() => (
          <div className="rejilla rejilla--mitad">
            <div className="pila">
              <Tarjeta titulo="Contexto de la venta" subtitulo="Las promociones dependen del día y la hora en que se cobra.">
                <div className="campos">
                  <label className="campo"><span>Día</span>
                    <select value={dia} onChange={(e) => setDia(Number(e.target.value))}>
                      {DIAS.map((d, i) => <option key={d} value={i}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                    </select>
                  </label>
                  <label className="campo"><span>Hora</span><input type="time" value={horaV} onChange={(e) => setHoraV(e.target.value)} /></label>
                </div>
                <div className="campo"><span>Casos de prueba</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CASOS.map((c) => <button key={c[0]} type="button" className="boton boton--secundario boton--chico" onClick={() => caso(c)}>{c[0]}</button>)}
                  </div>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Productos de la venta">
                {prod && (
                  <div className="campos">
                    <label className="campo"><span>Producto</span>
                      <select value={sel.producto} onChange={(e) => {
                        const p = ps.find((x) => String(x.id) === e.target.value);
                        setSel({ ...sel, producto: p.id, sabor: p.sabores[0].id });
                      }}>
                        {ps.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </label>
                    <label className="campo"><span>Sabor</span>
                      <select value={sel.sabor} onChange={(e) => setSel({ ...sel, sabor: Number(e.target.value) })}>
                        {prod.sabores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </label>
                    <div className="campo"><span>Cantidad</span><Contador valor={sel.cantidad} onChange={(n) => setSel({ ...sel, cantidad: Math.max(1, n) })} etiqueta="Cantidad" /></div>
                  </div>
                )}
                <button type="button" className="boton boton--primario" onClick={() => agregar(Number(sel.producto), Number(sel.sabor), sel.cantidad)}>Agregar a la venta</button>
                <h3 style={{ margin: '18px 0 6px' }}>En la venta</h3>
                {!items.length && <p className="muted">Aún no agregaste productos.</p>}
                <ul className="lista-simple">
                  {items.map((i) => (
                    <li key={`${i.producto_id}|${i.sabor_id}`}>
                      <span>{i.cantidad} × {etiqueta(i.producto_id, i.sabor_id)}</span>
                      <button type="button" className="boton boton--enlace" onClick={() => setItems(items.filter((x) => x !== i))}>Quitar</button>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            </div>

            <div className="pila">
              <Tarjeta titulo="Resultado" subtitulo={`${DIAS[dia]} a las ${horaV}`}>
                {res.error && <Aviso tono="error">{res.error.message}</Aviso>}
                {!res.data && !res.error && <p className="muted">Agrega productos o elige un caso de prueba.</p>}
                {res.data && (
                  <>
                    <Tabla filas={res.data.lineas} claveFila={(l, i) => i} columnas={[
                      { titulo: 'Producto · sabor', render: (l) => `${l.producto} · ${l.sabor}` },
                      { titulo: 'Cant.', num: true, campo: 'cantidad' },
                      { titulo: 'Promoción aplicada', render: (l) => l.promocion || <span className="muted">Ninguna</span> },
                      { titulo: 'Sin promo', num: true, render: (l) => soles(l.total_lista) },
                      { titulo: 'A cobrar', num: true, render: (l) => <strong>{soles(l.total)}</strong> },
                    ]} />
                    <div className="totales" style={{ marginTop: 12 }}>
                      <div><span>Subtotal sin promociones</span><span>{soles(res.data.subtotal)}</span></div>
                      <div><span>Descuento</span><span>− {soles(res.data.descuento)}</span></div>
                      <div className="total"><span>Total a cobrar</span><span>{soles(res.data.total)}</span></div>
                    </div>
                    {res.data.descuento > 0 && (
                      <Aviso tono="exito">El cliente ahorra {soles(res.data.descuento)} ({Math.round((res.data.descuento / res.data.subtotal) * 100)}%).</Aviso>
                    )}
                  </>
                )}
              </Tarjeta>
              {res.data && (
                <Tarjeta titulo="Promociones evaluadas" subtitulo="Así decidió el sistema con cada regla creada en Promociones.">
                  <ul className="vinetas">{res.data.motivos.map((m, i) => <li key={i} className="pequeno">{m}</li>)}</ul>
                </Tarjeta>
              )}
            </div>
          </div>
        )}
      </EstadoCarga>
    </>
  );
}
