import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ahoraLima, hora } from '../lib/format';
import { Aviso, Contador, Segmentado } from './ui';

// Planilla de entrega/recepción: cantidad de cada sabor por producto. Al confirmar, cada línea crea un lote en Día 1.
export default function Planilla({ productos, moduloId, moduloNombre, onRegistrada, textoBoton = 'Confirmar entrega' }) {
  const api = useApi();
  const [cant, setCant] = useState({});
  const [turno, setTurno] = useState(() => (Number(ahoraLima().hora.slice(0, 2)) >= 16 ? 'tarde' : 'manana'));
  const [estado, setEstado] = useState({ enviando: false, error: null, ok: null });

  const sabores = [...new Set(productos.flatMap((p) => p.sabores.map((s) => s.nombre)))];
  const clave = (p, s) => `${p.id}|${s.id}`;
  const total = Object.values(cant).reduce((a, n) => a + n, 0);

  async function confirmar() {
    const lineas = [];
    productos.forEach((p) => p.sabores.forEach((s) => {
      const n = cant[clave(p, s)] || 0;
      if (n > 0) lineas.push({ producto_id: p.id, sabor_id: s.id, cantidad: n });
    }));
    setEstado({ enviando: true, error: null, ok: null });
    try {
      const r = await api.post('/lotes/entrega', { modulo_id: Number(moduloId), lineas, turno });
      setCant({});
      setEstado({ enviando: false, error: null, ok: { unidades: r.unidades, lotes: r.lotes.length, hora: hora(r.lotes[0].fecha_recepcion) } });
      onRegistrada && onRegistrada(r);
    } catch (error) {
      setEstado({ enviando: false, error, ok: null });
    }
  }

  return (
    <div>
      <div className="tabla-scroll">
        <table className="tabla planilla">
          <thead>
            <tr>
              <th>Sabor</th>
              {productos.map((p) => <th key={p.id}>{p.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {sabores.map((nombre) => (
              <tr key={nombre}>
                <td className="negrita">{nombre}</td>
                {productos.map((p) => {
                  const s = p.sabores.find((x) => x.nombre === nombre);
                  return (
                    <td key={p.id}>
                      {s ? (
                        <Contador valor={cant[clave(p, s)] || 0} etiqueta={`${p.nombre} ${nombre}`}
                          onChange={(n) => setCant({ ...cant, [clave(p, s)]: n })} />
                      ) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="planilla__pie">
        <div className="campo">
          <span>Turno de recepción</span>
          <Segmentado etiqueta="Turno de recepción" valor={turno} onChange={setTurno}
            opciones={[{ valor: 'manana', texto: 'Mañana' }, { valor: 'tarde', texto: 'Tarde' }]} />
        </div>
        <div className="planilla__total"><strong>{total}</strong> unidades en esta entrega{moduloNombre ? ` · ${moduloNombre}` : ''}</div>
        <button type="button" className="boton boton--primario" disabled={!total || estado.enviando || !moduloId} onClick={confirmar}>
          {estado.enviando ? 'Registrando…' : textoBoton}
        </button>
      </div>
      {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}
      {estado.ok && (
        <Aviso tono="exito">
          Entrega registrada a las {estado.ok.hora}: {estado.ok.unidades} unidades en {estado.ok.lotes} {estado.ok.lotes === 1 ? 'lote nuevo' : 'lotes nuevos'}.
          Cada sabor entró como Día 1; el stock anterior sigue su propia rotación.
        </Aviso>
      )}
    </div>
  );
}
