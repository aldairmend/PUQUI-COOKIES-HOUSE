import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { vigenteAhora } from '../lib/promo';
import { ahoraLima, fechaHora, fechaLarga, hora, soles, turnoNombre } from '../lib/format';
import { Aviso, BarraLotes, Chip, EnlaceBoton, Encabezado, Kpi, LeyendaDias, Tabla, Tarjeta } from '../components/ui';

const CONTROLES = [
  'Conté el efectivo de la caja.',
  'Revisé que el stock del sistema coincide con lo que hay en las bandejas.',
  'Marqué las devoluciones pendientes.',
];

export default function MiTurno() {
  const api = useApi();
  const { usuario } = useAuth();
  const activo = useFetch('/turnos/activo');
  const stock = useFetch('/stock');
  const promos = useFetch('/promociones');
  const marcas = useFetch(`/asistencia?limit=5`);
  const nota = useFetch('/turnos/nota-anterior');
  const [checks, setChecks] = useState([false, false, false]);
  const [comentario, setComentario] = useState('');
  const [entrega, setEntrega] = useState({ enviando: false, error: null, hecha: null });

  const ctx = ahoraLima();
  const a = activo.data;
  const t = a && a.turno;
  const abierto = t && !t.hora_cierre;
  const vigentes = (promos.data || []).filter((p) => vigenteAhora(p, ctx));
  const marcaHoy = (marcas.data || []).find((m) => m.fecha_hora.slice(0, 10) === ctx.fecha);
  const grupos = stock.data ? stock.data.grupos.filter((g) => g.lotes.length) : [];
  const porDevolver = grupos.reduce((s, g) => s + g.por_devolver, 0);
  const primero = grupos.filter((g) => g.sale_primero).sort((x, y) => y.sale_primero.dia - x.sale_primero.dia)[0];
  const siguiente = a && a.tipo === 'manana' ? 'tarde' : 'mañana';

  async function entregar() {
    setEntrega({ enviando: true, error: null, hecha: null });
    try {
      const r = await api.post(`/turnos/${t.id}/entregar`, { comentario });
      setEntrega({ enviando: false, error: null, hecha: r });
      activo.reload();
      nota.reload();
    } catch (error) {
      setEntrega({ enviando: false, error, hecha: null });
    }
  }

  const notaAnterior = nota.data && (!t || nota.data.turno_id !== t.id) ? nota.data : null;

  return (
    <>
      <Encabezado path="/mi-turno" titulo="Mi turno"
        subtitulo={a ? `Turno de ${turnoNombre(a.tipo).toLowerCase()} · ${fechaLarga(a.fecha)} · ${usuario.modulo_nombre}` : usuario.modulo_nombre} />

      <div className="pila" style={{ gap: 0, marginBottom: 12 }}>
        {a && (abierto
          ? <Aviso tono="exito"><strong>Turno abierto</strong> desde las {hora(t.hora_apertura)}.</Aviso>
          : t ? <Aviso tono="info">El turno de {turnoNombre(a.tipo).toLowerCase()} ya se cerró.</Aviso>
            : <Aviso tono="error"><strong>Tu turno aún no está abierto.</strong> Abre la caja para poder vender. <Link to="/caja">Ir a Caja →</Link></Aviso>)}
        {marcas.data && (marcaHoy
          ? <Aviso tono={marcaHoy.dentro_rango ? 'exito' : 'aviso'}>Asistencia marcada a las {hora(marcaHoy.fecha_hora)} · a {Math.round(marcaHoy.distancia_m)} m del módulo{marcaHoy.dentro_rango ? '' : ' (fuera de rango)'}.</Aviso>
          : <Aviso tono="aviso">Aún no marcaste asistencia hoy. <Link to="/asistencia">Marcar ahora →</Link></Aviso>)}
        <Aviso tono="aviso"><strong>Promociones vigentes:</strong> {vigentes.length ? vigentes.map((p) => p.nombre).join(' · ') : 'ninguna en este momento.'}</Aviso>
      </div>

      <div className="rejilla rejilla--kpi">
        <Kpi etiqueta="Ventas del turno" valor={soles(a && a.resumen ? a.resumen.total : 0)}
          sub={a && a.resumen ? `Efectivo ${a.resumen.porMedio.efectivo} · Tarjeta ${a.resumen.porMedio.tarjeta} · Yape ${a.resumen.porMedio.yape}` : 'Sin turno abierto'} tono="exito" />
        <Kpi etiqueta="Efectivo esperado en caja" valor={soles(a && a.resumen ? a.resumen.esperado : 0)}
          sub={t ? `Apertura ${soles(t.efectivo_apertura)} + efectivo` : '—'} />
        <Kpi etiqueta="Vender primero" valor={primero ? `Día ${primero.sale_primero.dia}` : '—'}
          sub={primero ? `${primero.producto} · ${primero.sabor} (${primero.sale_primero.cantidad} uds)` : 'Sin stock'} tono="aviso" />
        <Kpi etiqueta="Por devolver" valor={`${porDevolver} uds`} sub={porDevolver ? 'Llegaron a su día límite' : 'Nada pendiente'} tono={porDevolver ? 'error' : 'exito'} />
      </div>

      <div className="rejilla rejilla--2">
        <Tarjeta titulo="Qué vender primero" subtitulo="Se vende primero el lote más antiguo de cada sabor. Esto reemplaza la hojita.">
          <LeyendaDias />
          <Tabla filas={grupos} claveFila={(g) => `${g.producto_id}|${g.sabor_id}`} vacio="No hay stock en el módulo." columnas={[
            { titulo: 'Sabor', render: (g) => <span><strong>{g.sabor}</strong><br /><span className="muted pequeno">{g.producto}</span></span> },
            { titulo: 'Lotes en el módulo', render: (g) => <BarraLotes limite={g.dias_limite_venta} lotes={g.lotes.map((l) => ({ dia: l.dia, cantidad: l.cantidad_actual }))} /> },
            { titulo: 'Vendibles', num: true, campo: 'total' },
            {
              titulo: 'Vender primero',
              render: (g) => (g.sale_primero ? <Chip tono="aviso">Día {g.sale_primero.dia} · {g.sale_primero.cantidad}</Chip> : <Chip tono="neutro">Agotado</Chip>),
            },
            { titulo: 'Devolver', num: true, render: (g) => (g.por_devolver ? <Chip tono="error">{g.por_devolver}</Chip> : '—') },
          ]} />
        </Tarjeta>

        <div className="pila">
          <Tarjeta titulo="Accesos rápidos">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <EnlaceBoton to="/ventas">Vender</EnlaceBoton>
              <EnlaceBoton to="/caja" variante="secundario">Caja</EnlaceBoton>
              <EnlaceBoton to="/distribucion" variante="secundario">Recepción</EnlaceBoton>
              <EnlaceBoton to="/devoluciones" variante="secundario">Devoluciones</EnlaceBoton>
            </div>
          </Tarjeta>

          {notaAnterior && (
            <Tarjeta titulo="Nota del turno anterior" subtitulo={`${notaAnterior.usuario} · ${fechaHora(notaAnterior.creado_en)}`}>
              <ul className="lista-simple pequeno">
                {notaAnterior.nota.stock.filter((s) => s.vender_primero || s.por_devolver).map((s) => (
                  <li key={s.producto + s.sabor}>
                    <span>{s.producto} · {s.sabor}</span>
                    <span>{s.vender_primero ? `vender Día ${s.vender_primero.dia} (${s.vender_primero.cantidad})` : ''}{s.por_devolver ? ` · devolver ${s.por_devolver}` : ''}</span>
                  </li>
                ))}
              </ul>
              <p className="pequeno" style={{ marginTop: 8 }}>Efectivo esperado al entregar: <strong>{soles(notaAnterior.nota.efectivo_esperado)}</strong></p>
              {notaAnterior.nota.comentario && <p className="pequeno">Comentario: «{notaAnterior.nota.comentario}»</p>}
            </Tarjeta>
          )}

          <Tarjeta titulo="Entrega de turno" subtitulo={`Antes de irte, confirma esto. La nota para el turno de ${siguiente} se arma sola.`}>
            {a && a.entrega ? (
              <Aviso tono="exito">Turno entregado a las {hora(a.entrega.creado_en)}. La nota quedó guardada para el turno siguiente y en el historial.</Aviso>
            ) : !t ? (
              <p className="muted">Abre tu turno para poder entregarlo al final.</p>
            ) : (
              <>
                {CONTROLES.map((c, i) => (
                  <label className="check" key={c}>
                    <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((x, j) => (j === i ? !x : x)))} />
                    <span>{c}</span>
                  </label>
                ))}
                <label className="campo" style={{ marginTop: 8 }}>
                  <span>Comentario para el siguiente turno (opcional)</span>
                  <textarea rows="2" maxLength="500" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </label>
                {entrega.error && <Aviso tono="error">{entrega.error.message}</Aviso>}
                <button type="button" className="boton boton--primario boton--bloque" disabled={!checks.every(Boolean) || entrega.enviando} onClick={entregar}>
                  {entrega.enviando ? 'Guardando…' : 'Entregar turno'}
                </button>
                <p className="muted pequeno" style={{ marginTop: 8 }}>
                  Caja: efectivo esperado {soles(a.resumen ? a.resumen.esperado : 0)} · Por devolver: {porDevolver} unidades. Después cierra la caja en <Link to="/caja">Caja</Link>.
                </p>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
