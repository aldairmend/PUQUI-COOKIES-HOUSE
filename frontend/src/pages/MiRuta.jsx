import { useState } from 'react';
import { useFetch } from '../hooks/useApi';
import { hora } from '../lib/format';
import Planilla from '../components/Planilla';
import { Chip, Encabezado, EstadoCarga, Tarjeta } from '../components/ui';
import { ListaPorDevolver } from './Devoluciones';

export default function MiRuta() {
  const ruta = useFetch('/ruta/hoy');
  const productos = useFetch('/productos');
  const [paradaId, setParadaId] = useState(null);

  return (
    <>
      <Encabezado path="/mi-ruta" titulo="Mi ruta de hoy"
        subtitulo="Registra lo que entregas en cada módulo, sabor por sabor, y marca lo que recoges para devolución. Cada entrega entra como Día 1." />
      <EstadoCarga estado={ruta}>
        {(paradas) => {
          const actual = paradas.find((p) => p.id === paradaId) || paradas.find((p) => !p.entregado) || paradas[0];
          const hechas = paradas.filter((p) => p.entregado).length;
          return (
            <div className="rejilla rejilla--2 rejilla--ruta">
              <Tarjeta titulo="Paradas" subtitulo={`${hechas} de ${paradas.length} módulos ya recibieron hoy.`}>
                <div className="pila" style={{ gap: 10 }}>
                  {paradas.map((p) => (
                    <button key={p.id} type="button" onClick={() => setParadaId(p.id)} aria-pressed={actual && actual.id === p.id}
                      className={`sabor-btn ${actual && actual.id === p.id ? 'sabor-btn--en-carrito' : ''}`} style={{ width: '100%' }}>
                      <span>
                        <span className="sabor-btn__nombre">{p.nombre}</span>
                        <span className="sabor-btn__detalle">{p.direccion}</span>
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {p.entregado ? <Chip tono="exito">Entregado {hora(p.primera_entrega)} · {p.unidades_hoy} uds</Chip> : <Chip tono="aviso">Pendiente</Chip>}
                          {p.por_recoger.length > 0 && <Chip tono="error">{p.por_recoger.reduce((a, l) => a + l.cantidad_actual, 0)} por recoger</Chip>}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Tarjeta>
              {actual && (
                <div className="pila">
                  <Tarjeta titulo={`Entrega en ${actual.nombre}`} subtitulo="Planilla sabor por producto: cada sabor entregado crea un lote nuevo en Día 1.">
                    <EstadoCarga estado={productos}>
                      {(ps) => <Planilla key={actual.id} productos={ps} moduloId={actual.id} moduloNombre={actual.nombre} onRegistrada={ruta.reload} />}
                    </EstadoCarga>
                  </Tarjeta>
                  <Tarjeta titulo={`Por recoger en ${actual.nombre}`} subtitulo="Lotes que ya llegaron a su día límite y pasan a devolución.">
                    <ListaPorDevolver lotes={actual.por_recoger.map((l) => ({ ...l, modulo: actual.nombre }))} mostrarModulo={false}
                      textoBoton="Marcar recogido" onHecho={ruta.reload} />
                  </Tarjeta>
                </div>
              )}
            </div>
          );
        }}
      </EstadoCarga>
    </>
  );
}
