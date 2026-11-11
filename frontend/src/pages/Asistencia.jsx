import { useState } from 'react';
import { useApi, useAuth, useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { acceso } from '../lib/roles';
import { fecha, hora, turnoNombre } from '../lib/format';
import { Aviso, Chip, Encabezado, EstadoCarga, SelectorModulo, Tabla, Tarjeta } from '../components/ui';

const distancia = (m) => (m === null || m === undefined ? '—' : `${Math.round(Number(m))} m`);

export default function Asistencia() {
  const api = useApi();
  const { usuario } = useAuth();
  const marca = acceso(usuario.rol, '/asistencia') !== 'ver';
  const veEquipo = usuario.rol !== 'vendedor';
  const mod = useModulo();
  const mias = useFetch(marca ? `/asistencia?usuario_id=${usuario.id}&limit=10` : null);
  const hoy = useFetch(veEquipo ? '/asistencia/hoy' : null);
  const [consiento, setConsiento] = useState(false);
  const [estado, setEstado] = useState({ enviando: false, error: null, ok: null });

  function marcar() {
    if (!('geolocation' in navigator)) {
      setEstado({ enviando: false, error: new Error('Este dispositivo no puede compartir su ubicación.'), ok: null });
      return;
    }
    setEstado({ enviando: true, error: null, ok: null });
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const a = await api.post('/asistencia', {
          modulo_id: Number(mod.moduloId), latitud: pos.coords.latitude, longitud: pos.coords.longitude,
        });
        setEstado({ enviando: false, error: null, ok: a });
        mias.reload();
        if (veEquipo) hoy.reload();
      } catch (error) {
        setEstado({ enviando: false, error, ok: null });
      }
    }, (err) => {
      const msg = err.code === 1
        ? 'No diste permiso para usar la ubicación. Actívalo en el navegador para marcar asistencia.'
        : 'No se pudo obtener la ubicación. Revisa que el GPS esté encendido e intenta de nuevo.';
      setEstado({ enviando: false, error: new Error(msg), ok: null });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return (
    <>
      <Encabezado path="/asistencia" titulo="Asistencia"
        subtitulo="Marca tu llegada al módulo con la ubicación del celular, en reemplazo del envío de ubicación por WhatsApp.">
        {marca && !mod.fijo && <SelectorModulo {...mod} label="Módulo donde marcas" />}
      </Encabezado>

      {marca && (
        <div className="rejilla rejilla--mitad">
          <Tarjeta titulo="Marcar mi llegada" subtitulo={mod.modulo ? `${mod.modulo.nombre} · radio autorizado: ${mod.modulo.radio_metros} m` : ''}>
            <label className="check">
              <input type="checkbox" checked={consiento} onChange={(e) => setConsiento(e.target.checked)} />
              <span className="pequeno">
                Autorizo que se registre mi ubicación <strong>solo en este momento</strong>, para verificar que estoy en el módulo
                (Ley N.° 29733 de protección de datos personales). No hay seguimiento continuo.
              </span>
            </label>
            <button type="button" className="boton boton--primario boton--bloque" disabled={!consiento || estado.enviando || !mod.moduloId} onClick={marcar}>
              {estado.enviando ? 'Obteniendo ubicación…' : 'Marcar asistencia'}
            </button>
            {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}
            {estado.ok && (
              <Aviso tono={estado.ok.dentro_rango ? 'exito' : 'aviso'}>
                {estado.ok.dentro_rango
                  ? `Asistencia registrada a las ${hora(estado.ok.fecha_hora)}, dentro del radio del módulo (a ${distancia(estado.ok.distancia_m)}).`
                  : `Asistencia registrada, pero fuera del radio: estás a ${distancia(estado.ok.distancia_m)} de ${estado.ok.modulo} (radio de ${estado.ok.radio_metros} m).`}
              </Aviso>
            )}
          </Tarjeta>
          <Tarjeta titulo="Tus últimas marcaciones">
            <EstadoCarga estado={mias}>
              {(ms) => (
                <Tabla filas={ms} vacio="Aún no marcaste asistencia." columnas={[
                  { titulo: 'Fecha', render: (m) => `${fecha(m.fecha_hora)} · ${hora(m.fecha_hora)}` },
                  { titulo: 'Turno', render: (m) => turnoNombre(m.turno) },
                  { titulo: 'Módulo', campo: 'modulo' },
                  { titulo: 'Distancia', num: true, render: (m) => distancia(m.distancia_m) },
                  { titulo: 'Estado', render: (m) => <Chip tono={m.dentro_rango ? 'exito' : 'error'}>{m.dentro_rango ? 'Dentro de rango' : 'Fuera de rango'}</Chip> },
                ]} />
              )}
            </EstadoCarga>
          </Tarjeta>
        </div>
      )}

      {veEquipo && (
        <Tarjeta titulo="Personal de hoy · todos los módulos" subtitulo="Quién marcó, a qué hora, a qué distancia del módulo y quién no marcó.">
          <EstadoCarga estado={hoy}>
            {(ps) => (
              <Tabla filas={ps} claveFila={(p) => p.usuario_id} columnas={[
                { titulo: 'Persona', render: (p) => <strong>{p.nombre}</strong> },
                { titulo: 'Módulo', render: (p) => p.modulo || '—' },
                { titulo: 'Turno', render: (p) => (p.turno ? turnoNombre(p.turno) : '—') },
                { titulo: 'Hora', render: (p) => (p.fecha_hora ? hora(p.fecha_hora) : '—') },
                { titulo: 'Distancia', num: true, render: (p) => distancia(p.distancia_m) },
                {
                  titulo: 'Estado',
                  render: (p) => (!p.fecha_hora ? <Chip tono="error">Sin marcar</Chip>
                    : p.dentro_rango ? <Chip tono="exito">Dentro de rango</Chip> : <Chip tono="aviso">Fuera de rango</Chip>),
                },
              ]} />
            )}
          </EstadoCarga>
        </Tarjeta>
      )}
    </>
  );
}
