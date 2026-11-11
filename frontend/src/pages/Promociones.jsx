import { useState } from 'react';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { acceso } from '../lib/roles';
import { DIAS, describirPromo, vigenteAhora } from '../lib/promo';
import { ahoraLima, fecha } from '../lib/format';
import { Aviso, Chip, Encabezado, EstadoCarga, Tarjeta } from '../components/ui';

const VACIO = { nombre: '', producto_id: '', sabor_id: '', dia_semana: '', hora_inicio: '', hora_fin: '', cantidad_minima: '1', tipo_descuento: 'porcentaje', valor: '' };
const TIPOS = [
  ['porcentaje', 'Porcentaje (%)'],
  ['monto_fijo', 'Monto fijo menos por unidad (S/)'],
  ['precio_fijo', 'Precio fijo por unidad (S/)'],
  ['lleva_paga', 'Lleva N, paga M (ej. 3x2)'],
];

export default function Promociones() {
  const api = useApi();
  const { usuario } = useAuth();
  const puedeEditar = acceso(usuario.rol, '/promociones') === 'completo';
  const promos = useFetch(puedeEditar ? '/promociones?todas=1' : '/promociones');
  const productos = useFetch('/productos');
  const [f, setF] = useState(VACIO);
  const [estado, setEstado] = useState({ enviando: false, error: null, ok: null });
  const ctx = ahoraLima();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'producto_id' ? { sabor_id: '' } : {}) });
  const esLleva = f.tipo_descuento === 'lleva_paga';

  async function crear(e) {
    e.preventDefault();
    setEstado({ enviando: true, error: null, ok: null });
    try {
      const p = await api.post('/promociones', f);
      setEstado({ enviando: false, error: null, ok: `Promoción «${p.nombre}» creada. Ya se aplica sola al vender.` });
      setF(VACIO);
      promos.reload();
    } catch (error) {
      setEstado({ enviando: false, error, ok: null });
    }
  }

  async function desactivar(p) {
    if (!window.confirm(`¿Desactivar «${p.nombre}»? Dejará de aplicarse en las ventas.`)) return;
    try {
      await api.patch(`/promociones/${p.id}/desactivar`);
      setEstado({ enviando: false, error: null, ok: `«${p.nombre}» quedó desactivada.` });
      promos.reload();
    } catch (error) {
      setEstado({ enviando: false, error, ok: null });
    }
  }

  const producto = (productos.data || []).find((p) => String(p.id) === String(f.producto_id));

  return (
    <>
      <Encabezado path="/promociones" titulo="Promociones"
        subtitulo="Reglas por producto, sabor, día, horario y cantidad. Si varias aplican a la vez, el sistema usa la que deja el menor precio para el cliente." />
      {estado.ok && <Aviso tono="exito">{estado.ok}</Aviso>}
      {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}

      <div className={puedeEditar ? 'rejilla rejilla--mitad' : ''}>
        {puedeEditar && (
          <Tarjeta titulo="Nueva promoción" subtitulo="Deja en «Todos» lo que no quieras restringir.">
            <form onSubmit={crear}>
              <label className="campo"><span>Nombre</span><input required value={f.nombre} onChange={set('nombre')} placeholder="Ej. 3x2 en Flat Cookie" /></label>
              <div className="campos">
                <label className="campo"><span>Producto</span>
                  <select value={f.producto_id} onChange={set('producto_id')}>
                    <option value="">Todos</option>
                    {(productos.data || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </label>
                <label className="campo"><span>Sabor</span>
                  <select value={f.sabor_id} onChange={set('sabor_id')} disabled={!producto}>
                    <option value="">Todos</option>
                    {producto && producto.sabores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
                <label className="campo"><span>Día</span>
                  <select value={f.dia_semana} onChange={set('dia_semana')}>
                    <option value="">Todos los días</option>
                    {DIAS.map((d, i) => <option key={d} value={i}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </label>
                <label className="campo"><span>Desde (hora)</span><input type="time" value={f.hora_inicio} onChange={set('hora_inicio')} /></label>
                <label className="campo"><span>Hasta (hora)</span><input type="time" value={f.hora_fin} onChange={set('hora_fin')} /></label>
                <label className="campo"><span>Tipo de descuento</span>
                  <select value={f.tipo_descuento} onChange={set('tipo_descuento')}>
                    {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="campo"><span>{esLleva ? 'Lleva (N)' : 'Cantidad mínima'}</span>
                  <input type="number" min="1" step="1" required value={f.cantidad_minima} onChange={set('cantidad_minima')} />
                </label>
                <label className="campo"><span>{esLleva ? 'Paga (M)' : f.tipo_descuento === 'porcentaje' ? 'Porcentaje' : 'Monto (S/)'}</span>
                  <input type="number" min="0" step={esLleva ? '1' : '0.10'} required value={f.valor} onChange={set('valor')} />
                </label>
              </div>
              <button className="boton boton--primario boton--bloque" disabled={estado.enviando}>Crear promoción</button>
            </form>
          </Tarjeta>
        )}

        <Tarjeta titulo="Promociones" subtitulo={`Se aplican solas al vender. Ahora: ${DIAS[ctx.diaSemana]} ${ctx.hora}.`}>
          <EstadoCarga estado={promos}>
            {(ps) => (
              <ul className="lista-simple">
                {ps.length === 0 && <li className="muted">No hay promociones.</li>}
                {ps.map((p) => (
                  <li key={p.id} style={{ alignItems: 'center', opacity: p.activo ? 1 : 0.6 }}>
                    <span>
                      <strong>{p.nombre}</strong>{' '}
                      {!p.activo ? <Chip tono="neutro">Desactivada</Chip> : vigenteAhora(p, ctx) ? <Chip tono="exito">Vigente ahora</Chip> : <Chip tono="info">Activa</Chip>}
                      <br /><span className="muted pequeno">{describirPromo(p)}</span>
                      {p.creado_por_nombre && <><br /><span className="muted pequeno">Creada por {p.creado_por_nombre} · {fecha(p.creado_en)}</span></>}
                    </span>
                    {puedeEditar && p.activo && (
                      <button type="button" className="boton boton--secundario boton--chico" onClick={() => desactivar(p)}>Desactivar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </EstadoCarga>
        </Tarjeta>
      </div>
    </>
  );
}
