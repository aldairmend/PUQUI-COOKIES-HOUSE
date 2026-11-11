import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { mejorPromocion, vigenteAhora } from '../lib/promo';
import { ahoraLima, hora, medioNombre, soles, turnoNombre } from '../lib/format';
import { Aviso, Cargando, Encabezado, Icono, Segmentado, SelectorModulo, Tarjeta } from '../components/ui';

const MEDIOS = ['efectivo', 'tarjeta', 'yape'].map((m) => ({ valor: m, texto: medioNombre(m) }));

// Plan FIFO: de qué lotes saldrá una cantidad (los lotes vendibles ya vienen del más antiguo al más nuevo).
function planFIFO(lotes, cantidad) {
  const partes = [];
  let resto = cantidad;
  for (const l of lotes) {
    if (resto <= 0) break;
    const tomar = Math.min(l.cantidad_actual, resto);
    partes.push(`Día ${l.dia} ×${tomar}`);
    resto -= tomar;
  }
  return partes.join(' · ');
}

export default function Ventas() {
  const api = useApi();
  const { usuario } = useAuth();
  const mod = useModulo();
  const q = mod.moduloId ? `?modulo_id=${mod.moduloId}` : null;
  const productos = useFetch('/productos');
  const stock = useFetch(q && `/stock${q}`);
  const turno = useFetch(q && `/turnos/activo${q}`);
  const promos = useFetch('/promociones');
  const [carrito, setCarrito] = useState({});
  const [medio, setMedio] = useState('efectivo');
  const [envio, setEnvio] = useState({ enviando: false, error: null, hecha: null });

  if (!productos.data || !stock.data || !turno.data || !promos.data) {
    const err = productos.error || stock.error || turno.error || promos.error;
    return (
      <>
        <Encabezado path="/ventas" titulo="Ventas" />
        {err ? <Aviso tono="error">{err.message}</Aviso> : <Cargando />}
      </>
    );
  }

  const ctx = ahoraLima();
  const vigentes = promos.data.filter((p) => vigenteAhora(p, ctx));
  const grupo = (pid, sid) => stock.data.grupos.find((g) => g.producto_id === pid && g.sabor_id === sid);
  const vendibles = (g) => (g ? g.lotes.filter((l) => !l.debe_devolverse) : []);
  const t = turno.data.turno;
  const abierto = t && !t.hora_cierre;

  const lineas = Object.entries(carrito).map(([k, cantidad]) => {
    const [pid, sid] = k.split('|').map(Number);
    const p = productos.data.find((x) => x.id === pid);
    const s = p.sabores.find((x) => x.id === sid);
    const g = grupo(pid, sid);
    const r = mejorPromocion(promos.data, { productoId: pid, saborId: sid, cantidad, precioLista: p.precio_base }, ctx);
    return { k, pid, sid, p, s, cantidad, disponible: g ? g.total : 0, plan: planFIFO(vendibles(g), cantidad), ...r };
  });
  const subtotal = lineas.reduce((a, l) => a + l.totalLista, 0);
  const total = lineas.reduce((a, l) => a + l.total, 0);

  const cambiar = (k, n, max) => {
    const c = { ...carrito };
    if (n <= 0) delete c[k];
    else c[k] = Math.min(n, max);
    setCarrito(c);
    setEnvio((e) => ({ ...e, error: null, hecha: null }));
  };

  async function registrar() {
    setEnvio({ enviando: true, error: null, hecha: null });
    try {
      const v = await api.post('/ventas', {
        modulo_id: Number(mod.moduloId),
        medio_pago: medio,
        items: lineas.map((l) => ({ producto_id: l.pid, sabor_id: l.sid, cantidad: l.cantidad })),
      });
      setCarrito({});
      setEnvio({ enviando: false, error: null, hecha: v });
      stock.reload();
      turno.reload();
    } catch (error) {
      setEnvio({ enviando: false, error, hecha: null });
      stock.reload();
    }
  }

  return (
    <>
      <Encabezado path="/ventas" titulo="Ventas"
        subtitulo="Punto de venta por producto y sabor, con descuento automático de stock (FIFO) y promociones.">
        {!mod.fijo && <SelectorModulo {...mod} />}
      </Encabezado>

      {abierto ? (
        <Aviso tono="exito">
          <strong>Turno de {turnoNombre(t.tipo).toLowerCase()} abierto</strong> desde las {hora(t.hora_apertura)} · {mod.modulo && mod.modulo.nombre} · {usuario.nombre}
        </Aviso>
      ) : (
        <Aviso tono="error">
          <strong>No hay un turno de {turnoNombre(turno.data.tipo).toLowerCase()} abierto.</strong> Para vender, primero abre la caja.{' '}
          <Link to="/caja">Ir a Caja →</Link>
        </Aviso>
      )}
      <Aviso tono="aviso">
        <strong>Promociones vigentes ahora ({ctx.hora}):</strong>{' '}
        {vigentes.length ? vigentes.map((p) => p.nombre).join(' · ') : 'ninguna en este momento.'}
      </Aviso>

      <div className="rejilla rejilla--2">
        <div className="pila">
          {productos.data.map((p) => (
            <Tarjeta key={p.id} titulo={p.nombre} acciones={<span className="muted pequeno">{soles(p.precio_base)} · se vende hasta el Día {p.dias_limite_venta - 1}</span>}>
              <div className="sabores">
                {p.sabores.map((s) => {
                  const k = `${p.id}|${s.id}`;
                  const g = grupo(p.id, s.id);
                  const disp = g ? g.total : 0;
                  const enCarrito = carrito[k] || 0;
                  const sinMas = disp - enCarrito <= 0;
                  return (
                    <button key={s.id} type="button" className={`sabor-btn ${enCarrito ? 'sabor-btn--en-carrito' : ''}`}
                      disabled={sinMas || !abierto} onClick={() => cambiar(k, enCarrito + 1, disp)}
                      aria-label={`Agregar ${p.nombre} ${s.nombre}. ${disp ? `${disp} disponibles` : 'Agotado'}`}>
                      <span>
                        <span className="sabor-btn__nombre">{s.nombre}</span>
                        <span className="sabor-btn__detalle" style={{ color: disp ? undefined : 'var(--error)' }}>
                          {disp ? `${disp} uds · sale Día ${g.sale_primero.dia}` : 'Agotado'}
                        </span>
                      </span>
                      {enCarrito > 0 ? <span className="burbuja">{enCarrito}</span> : (!sinMas && abierto && <Icono nombre="mas" size={18} />)}
                    </button>
                  );
                })}
              </div>
            </Tarjeta>
          ))}
        </div>

        <div className="pegajoso">
          {envio.hecha && (
            <Aviso tono="exito">
              <strong>Venta registrada: {soles(envio.hecha.monto_total)} ({medioNombre(envio.hecha.medio_pago).toLowerCase()}).</strong>
              {envio.hecha.detalle.map((d) => (
                <div key={d.producto + d.sabor} className="pequeno">
                  {d.cantidad} × {d.producto} · {d.sabor} — salió de {d.lotes.map((l) => `Día ${l.dia} ×${l.cantidad}`).join(' · ')}
                  {d.promocion ? ` · ${d.promocion}` : ''}
                </div>
              ))}
            </Aviso>
          )}
          <Tarjeta titulo="Carrito">
            {lineas.length === 0 && <p className="muted">Toca un sabor para agregarlo. Prueba con 3 Flat Cookie (3x2) o 3 Cookie Cup Nutella para ver la promoción.</p>}
            {lineas.map((l) => (
              <div className="carrito-linea" key={l.k}>
                <div className="carrito-linea__fila">
                  <div>
                    <div className="negrita">{l.p.nombre} · {l.s.nombre}</div>
                    <div className="muted pequeno">{soles(l.p.precio_base)} c/u · <strong>{soles(l.total)}</strong></div>
                  </div>
                  <div className="contador">
                    <button type="button" aria-label="Quitar uno" onClick={() => cambiar(l.k, l.cantidad - 1, l.disponible)}><Icono nombre="menos" size={16} /></button>
                    <input readOnly value={l.cantidad} aria-label="Cantidad" />
                    <button type="button" aria-label="Agregar uno" disabled={l.cantidad >= l.disponible} onClick={() => cambiar(l.k, l.cantidad + 1, l.disponible)}><Icono nombre="mas" size={16} /></button>
                  </div>
                </div>
                {l.promo && <div className="pequeno" style={{ color: 'var(--exito)', fontWeight: 600 }}>Promo aplicada: {l.promo.nombre} (− {soles(l.descuento)})</div>}
                <div className="muted pequeno">Saldrá de: {l.plan}</div>
              </div>
            ))}
            {lineas.length > 0 && (
              <>
                <div className="campo" style={{ marginTop: 14 }}>
                  <span>Medio de pago</span>
                  <Segmentado etiqueta="Medio de pago" opciones={MEDIOS} valor={medio} onChange={setMedio} />
                </div>
                <div className="totales">
                  <div><span>Subtotal</span><span>{soles(subtotal)}</span></div>
                  <div><span>Descuento por promociones</span><span>− {soles(subtotal - total)}</span></div>
                  <div className="total"><strong>Total</strong><strong>{soles(total)}</strong></div>
                </div>
                {envio.error && <Aviso tono="error">{envio.error.message}</Aviso>}
                <button type="button" className="boton boton--primario boton--bloque" style={{ marginTop: 12 }}
                  disabled={envio.enviando || !abierto} onClick={registrar}>
                  {envio.enviando ? 'Registrando…' : `Registrar venta · ${soles(total)}`}
                </button>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
