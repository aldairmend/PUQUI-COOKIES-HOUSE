import { useState } from 'react';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { acceso } from '../lib/roles';
import { fecha, fechaLarga, hora, medioNombre, soles, turnoNombre } from '../lib/format';
import { Aviso, Chip, Encabezado, EstadoCarga, SelectorModulo, Tabla, Tarjeta } from '../components/ui';

export function ColorDesajuste({ valor }) {
  if (valor === null || valor === undefined) return <span className="muted">—</span>;
  const v = Number(valor);
  return <span style={{ fontWeight: 700, color: v === 0 ? 'var(--exito)' : 'var(--error)' }}>{v > 0 ? '+' : ''}{soles(v)}</span>;
}

export default function Caja() {
  const api = useApi();
  const { usuario } = useAuth();
  const soloVer = acceso(usuario.rol, '/caja') === 'ver';
  const mod = useModulo();
  const q = mod.moduloId ? `?modulo_id=${mod.moduloId}` : null;
  const activo = useFetch(q && `/turnos/activo${q}`);
  const historial = useFetch(q && `/turnos${q}&limit=12`);
  const [monto, setMonto] = useState('100.00');
  const [contado, setContado] = useState('');
  const [estado, setEstado] = useState({ enviando: false, error: null, ok: null });

  const recargar = () => { activo.reload(); historial.reload(); };

  async function enviar(fn, ok) {
    setEstado({ enviando: true, error: null, ok: null });
    try {
      const r = await fn();
      setEstado({ enviando: false, error: null, ok: ok(r) });
      setContado('');
      recargar();
    } catch (error) {
      setEstado({ enviando: false, error, ok: null });
    }
  }
  const abrir = () => enviar(() => api.post('/turnos/abrir', { modulo_id: Number(mod.moduloId), efectivo_apertura: Number(monto) }),
    (t) => `Turno abierto a las ${hora(t.hora_apertura)} con ${soles(t.efectivo_apertura)}. Ya puedes vender.`);
  const cerrar = (t) => enviar(() => api.patch(`/turnos/${t.id}/cerrar`, { efectivo_cierre: Number(contado) }),
    (r) => (Number(r.desajuste) === 0 ? 'Turno cerrado: la caja cuadra.' : `Turno cerrado con un desajuste de ${soles(r.desajuste)} (${Number(r.desajuste) < 0 ? 'falta' : 'sobra'} efectivo).`));

  return (
    <>
      <Encabezado path="/caja" titulo="Caja"
        subtitulo="Apertura y cierre conciliados automáticamente contra las ventas registradas: el sistema calcula el efectivo esperado y el desajuste.">
        {!mod.fijo && <SelectorModulo {...mod} />}
      </Encabezado>
      {estado.ok && <Aviso tono="exito">{estado.ok}</Aviso>}
      {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}

      <EstadoCarga estado={activo}>
        {(a) => {
          const t = a.turno;
          const r = a.resumen;
          return (
            <div className="rejilla rejilla--mitad">
              <Tarjeta titulo={`Turno de ${turnoNombre(a.tipo).toLowerCase()} · ${fechaLarga(a.fecha)}`} subtitulo={mod.modulo && mod.modulo.nombre}>
                {!t && (soloVer ? <p className="muted">Este turno aún no se abrió.</p> : (
                  <form onSubmit={(e) => { e.preventDefault(); abrir(); }}>
                    <label className="campo">
                      <span>Efectivo con el que abres caja (S/)</span>
                      <input type="number" inputMode="decimal" min="0" step="0.10" required value={monto} onChange={(e) => setMonto(e.target.value)} />
                    </label>
                    <button className="boton boton--primario boton--bloque" disabled={estado.enviando || monto === ''}>Abrir turno</button>
                  </form>
                ))}
                {t && (
                  <>
                    <div className="totales">
                      <div><span>Abrió</span><span>{t.usuario_nombre} · {hora(t.hora_apertura)}</span></div>
                      <div><span>Apertura</span><span>{soles(t.efectivo_apertura)}</span></div>
                      <div><span>Ventas en efectivo</span><span>{soles(r.porMedio.efectivo)}</span></div>
                      <div className="total"><span>Efectivo esperado</span><span>{soles(r.esperado)}</span></div>
                      {t.hora_cierre && (
                        <>
                          <div><span>Efectivo contado ({hora(t.hora_cierre)})</span><span>{soles(t.efectivo_cierre)}</span></div>
                          <div><span>Desajuste</span><ColorDesajuste valor={t.desajuste} /></div>
                        </>
                      )}
                    </div>
                    {!t.hora_cierre && !soloVer && (
                      <form style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); cerrar(t); }}>
                        <label className="campo">
                          <span>Efectivo contado al cierre (S/)</span>
                          <input type="number" inputMode="decimal" min="0" step="0.10" required value={contado} onChange={(e) => setContado(e.target.value)} />
                        </label>
                        {contado !== '' && (
                          <p className="pequeno" style={{ marginBottom: 10 }}>
                            Desajuste si cierras ahora: <ColorDesajuste valor={Math.round((Number(contado) - r.esperado) * 100) / 100} />
                          </p>
                        )}
                        <button className="boton boton--primario boton--bloque" disabled={estado.enviando || contado === ''}>Cerrar turno</button>
                      </form>
                    )}
                    {t.hora_cierre && <Aviso tono="info">Este turno ya fue cerrado.</Aviso>}
                  </>
                )}
              </Tarjeta>
              <Tarjeta titulo="Ventas registradas en este turno" subtitulo="Se suman solas desde Ventas; no hay que copiarlas.">
                {!r && <p className="muted">Abre el turno para empezar a registrar ventas y ver el resumen aquí.</p>}
                {r && (
                  <div className="totales">
                    {['efectivo', 'tarjeta', 'yape'].map((m) => <div key={m}><span>{medioNombre(m)}</span><span>{soles(r.porMedio[m])}</span></div>)}
                    <div className="total"><span>Total vendido</span><span>{soles(r.total)}</span></div>
                    <div className="muted pequeno">{r.ventas} ventas</div>
                  </div>
                )}
              </Tarjeta>
            </div>
          );
        }}
      </EstadoCarga>

      <Tarjeta titulo="Últimos turnos" subtitulo="Historial con efectivo esperado, contado y desajuste.">
        <EstadoCarga estado={historial}>
          {(hs) => (
            <Tabla filas={hs} columnas={[
              { titulo: 'Fecha', render: (h) => fecha(h.fecha) },
              { titulo: 'Turno', render: (h) => turnoNombre(h.tipo) },
              { titulo: 'Abrió', campo: 'usuario' },
              { titulo: 'Ventas', num: true, render: (h) => soles(h.ventas_total) },
              { titulo: 'Apertura', num: true, render: (h) => soles(h.efectivo_apertura) },
              { titulo: 'Esperado', num: true, render: (h) => (h.efectivo_esperado === null ? '—' : soles(h.efectivo_esperado)) },
              { titulo: 'Contado', num: true, render: (h) => (h.efectivo_cierre === null ? '—' : soles(h.efectivo_cierre)) },
              { titulo: 'Desajuste', num: true, render: (h) => (h.hora_cierre ? <ColorDesajuste valor={h.desajuste} /> : <Chip tono="exito">Abierto</Chip>) },
            ]} />
          )}
        </EstadoCarga>
      </Tarjeta>
    </>
  );
}
