import { useState } from 'react';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { acceso, PANTALLAS, tituloPara } from '../lib/roles';
import { fecha, fechaHora, motivoNombre } from '../lib/format';
import { Aviso, Chip, Encabezado, EstadoCarga, SelectorModulo, Tabla, Tarjeta } from '../components/ui';

// Lista de lotes por devolver con el botón que los pasa a devolución (reutilizada en «Mi ruta»).
export function ListaPorDevolver({ lotes, soloVer, onHecho, textoBoton = 'Pasar a devolución', mostrarModulo = true }) {
  const api = useApi();
  const [estado, setEstado] = useState({ id: null, error: null, ok: null });

  async function devolver(l) {
    setEstado({ id: l.lote_id, error: null, ok: null });
    try {
      await api.post('/devoluciones', { lote_id: l.lote_id, motivo: 'limite_dias' });
      setEstado({ id: null, error: null, ok: `${l.cantidad_actual} unidades de ${l.producto} · ${l.sabor} pasaron a devolución.` });
      onHecho && onHecho();
    } catch (error) {
      setEstado({ id: null, error, ok: null });
    }
  }

  return (
    <>
      {estado.ok && <Aviso tono="exito">{estado.ok}</Aviso>}
      {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}
      <Tabla filas={lotes} claveFila={(l) => l.lote_id} vacio="No hay lotes por devolver. ✔" columnas={[
        ...(mostrarModulo ? [{ titulo: 'Módulo', campo: 'modulo' }] : []),
        { titulo: 'Producto · sabor', render: (l) => <strong>{l.producto} · {l.sabor}</strong> },
        { titulo: 'Unidades', num: true, campo: 'cantidad_actual' },
        { titulo: 'Día', render: (l) => <Chip tono="error">Día {l.dia} de {l.dia_limite}</Chip> },
        { titulo: 'Recibido', render: (l) => fecha(l.fecha_recepcion) },
        ...(soloVer ? [] : [{
          titulo: 'Acción',
          render: (l) => (
            <button type="button" className="boton boton--secundario boton--chico" disabled={estado.id === l.lote_id} onClick={() => devolver(l)}>
              {estado.id === l.lote_id ? 'Registrando…' : textoBoton}
            </button>
          ),
        }]),
      ]} />
    </>
  );
}

export default function Devoluciones() {
  const { usuario } = useAuth();
  const soloVer = acceso(usuario.rol, '/devoluciones') === 'ver';
  const titulo = tituloPara(PANTALLAS.find((p) => p.path === '/devoluciones'), usuario.rol);
  const mod = useModulo({ conTodos: true });
  const q = mod.moduloId ? `?modulo_id=${mod.moduloId}` : '';
  const pendientes = useFetch(`/devoluciones/pendientes${q}`);
  const historial = useFetch(`/devoluciones${q}${q ? '&' : '?'}limit=40`);

  return (
    <>
      <Encabezado path="/devoluciones" titulo={titulo}
        subtitulo="Los lotes que llegaron a su día límite dejan de venderse y se devuelven. Cada devolución queda ligada a su lote, producto, sabor, módulo y fecha.">
        {!mod.fijo && <SelectorModulo {...mod} conTodos />}
      </Encabezado>
      <Tarjeta className="bloque" titulo="Lotes por devolver" subtitulo="Llegaron a su día límite: ya no se pueden vender.">
        <EstadoCarga estado={pendientes}>
          {(ls) => (
            <ListaPorDevolver lotes={ls} soloVer={soloVer} mostrarModulo={!mod.fijo}
              textoBoton={usuario.rol === 'repartidor' ? 'Marcar recogido' : 'Pasar a devolución'}
              onHecho={() => { pendientes.reload(); historial.reload(); }} />
          )}
        </EstadoCarga>
      </Tarjeta>
      <div style={{ height: 20 }} />
      <Tarjeta titulo="Historial de devoluciones">
        <EstadoCarga estado={historial}>
          {(hs) => (
            <Tabla filas={hs} vacio="Aún no hay devoluciones." columnas={[
              { titulo: 'Fecha', render: (h) => fechaHora(h.fecha) },
              { titulo: 'Módulo', campo: 'modulo' },
              { titulo: 'Producto · sabor', render: (h) => `${h.producto} · ${h.sabor}` },
              { titulo: 'Unidades', num: true, campo: 'cantidad' },
              { titulo: 'Día del lote', render: (h) => `Día ${h.dia}` },
              { titulo: 'Motivo', render: (h) => <Chip tono={h.motivo === 'limite_dias' ? 'neutro' : 'aviso'}>{motivoNombre(h.motivo)}</Chip> },
              { titulo: 'Registró', campo: 'usuario' },
            ]} />
          )}
        </EstadoCarga>
      </Tarjeta>
    </>
  );
}
