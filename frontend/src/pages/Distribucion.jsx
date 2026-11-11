import { useAuth, useFetch } from '../hooks/useApi';
import { useModulo } from '../hooks/useModulo';
import { acceso, PANTALLAS, tituloPara } from '../lib/roles';
import { fechaHora, turnoNombre } from '../lib/format';
import Planilla from '../components/Planilla';
import { Chip, Encabezado, EstadoCarga, SelectorModulo, Tabla, Tarjeta } from '../components/ui';

const ESTADO = { activo: ['exito', 'Activo'], agotado: ['neutro', 'Agotado'], devuelto: ['error', 'Devuelto'] };

export default function Distribucion() {
  const { usuario } = useAuth();
  const soloVer = acceso(usuario.rol, '/distribucion') === 'ver';
  const titulo = tituloPara(PANTALLAS.find((p) => p.path === '/distribucion'), usuario.rol);
  const mod = useModulo();
  const productos = useFetch('/productos');
  const lotes = useFetch(mod.moduloId ? `/lotes?modulo_id=${mod.moduloId}&limit=30` : null);

  return (
    <>
      <Encabezado path="/distribucion" titulo={titulo}
        subtitulo="Registra lo que llega a un módulo. Para cada sabor y producto se anota la cantidad recibida y, al confirmar, se crean lotes nuevos en Día 1.">
        {!mod.fijo && <SelectorModulo {...mod} />}
      </Encabezado>

      {!soloVer && (
        <Tarjeta className="bloque" titulo={`Planilla de ${usuario.rol === 'vendedor' ? 'recepción' : 'entrega'} · ${mod.modulo ? mod.modulo.nombre : ''}`}
          subtitulo="Cantidad de cada sabor que llegó. Deja en 0 los sabores que no llegaron.">
          <EstadoCarga estado={productos}>
            {(ps) => (
              <Planilla productos={ps} moduloId={mod.moduloId} moduloNombre={mod.modulo && mod.modulo.nombre}
                textoBoton={usuario.rol === 'vendedor' ? 'Confirmar recepción' : 'Confirmar entrega'} onRegistrada={lotes.reload} />
            )}
          </EstadoCarga>
        </Tarjeta>
      )}
      <div style={{ height: 20 }} />
      <Tarjeta titulo={`Últimos lotes de ${mod.modulo ? mod.modulo.nombre : 'el módulo'}`} subtitulo="Cantidad actual sobre la recibida, día de antigüedad y estado.">
        <EstadoCarga estado={lotes}>
          {(ls) => (
            <Tabla filas={ls} vacio="Este módulo aún no recibió lotes." columnas={[
              { titulo: 'Recibido', render: (l) => fechaHora(l.fecha_recepcion) },
              { titulo: 'Turno', render: (l) => turnoNombre(l.turno_recepcion) },
              { titulo: 'Producto', campo: 'producto' },
              { titulo: 'Sabor', campo: 'sabor' },
              { titulo: 'Quedan / recibidas', num: true, render: (l) => `${l.cantidad_actual} / ${l.cantidad_inicial}` },
              { titulo: 'Día', render: (l) => (l.estado === 'activo' ? <Chip tono={l.dia >= l.dia_limite ? 'error' : l.dia === 1 ? 'exito' : 'info'}>Día {l.dia}</Chip> : '—') },
              { titulo: 'Estado', render: (l) => <Chip tono={ESTADO[l.estado][0]}>{ESTADO[l.estado][1]}</Chip> },
              { titulo: 'Entregó', render: (l) => l.repartidor || '—' },
            ]} />
          )}
        </EstadoCarga>
      </Tarjeta>
    </>
  );
}
