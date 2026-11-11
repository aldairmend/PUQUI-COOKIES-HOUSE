// Motor de promociones (RN-06, RN-07). Funciones puras, sin acceso a la base, para poder probarlas solas.
// La misma lógica está en frontend/src/lib/promo.js para mostrar el carrito y el aplicador.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

function totalConPromocion(promo, precioLista, cantidad) {
  const valor = Number(promo.valor);
  switch (promo.tipo_descuento) {
    case 'porcentaje':
      return redondear(precioLista * (1 - valor / 100) * cantidad);
    case 'monto_fijo':
      return redondear(Math.max(0, precioLista - valor) * cantidad);
    case 'precio_fijo':
      return redondear(valor * cantidad);
    case 'lleva_paga': {
      // 3x2: lleva = 3 (cantidad_minima), paga = 2 (valor). Por cada N salen gratis N − M (RN-07).
      const lleva = Number(promo.cantidad_minima);
      const gratis = Math.floor(cantidad / lleva) * Math.max(0, lleva - valor);
      return redondear(precioLista * (cantidad - Math.min(gratis, cantidad)));
    }
    default:
      return redondear(precioLista * cantidad);
  }
}

// Devuelve null si la promoción aplica a la línea en ese contexto, o el motivo por el que no aplica.
function motivoNoAplica(promo, linea, ctx) {
  if (promo.activo === false) return 'está desactivada';
  if (promo.producto_id && Number(promo.producto_id) !== Number(linea.productoId)) {
    return `es solo para ${promo.producto_nombre || 'otro producto'}`;
  }
  if (promo.sabor_id && Number(promo.sabor_id) !== Number(linea.saborId)) {
    return `es solo para el sabor ${promo.sabor_nombre || 'indicado'}`;
  }
  if (promo.dia_semana !== null && promo.dia_semana !== undefined && promo.dia_semana !== '' &&
      Number(promo.dia_semana) !== Number(ctx.diaSemana)) {
    return `solo rige los ${DIAS[Number(promo.dia_semana)]}`;
  }
  const ini = hhmm(promo.hora_inicio);
  const fin = hhmm(promo.hora_fin);
  const hora = hhmm(ctx.hora);
  if ((ini && hora < ini) || (fin && hora >= fin)) {
    return `solo rige ${ini ? 'desde las ' + ini : ''}${ini && fin ? ' ' : ''}${fin ? 'hasta las ' + fin : ''}`.trim();
  }
  if (linea.cantidad < Number(promo.cantidad_minima || 1)) {
    return `pide al menos ${promo.cantidad_minima} unidades`;
  }
  return null;
}

// Evalúa todas las promociones para una línea y elige la que deja el menor total (RN-06).
function mejorPromocion(promos, linea, ctx) {
  const precioLista = Number(linea.precioLista);
  const totalLista = redondear(precioLista * linea.cantidad);
  const evaluadas = promos.map((promo) => {
    const motivo = motivoNoAplica(promo, linea, ctx);
    if (motivo) return { promo, aplica: false, motivo };
    const total = totalConPromocion(promo, precioLista, linea.cantidad);
    if (total >= totalLista) return { promo, aplica: false, motivo: 'no baja el precio de lista', total };
    return { promo, aplica: true, total };
  });
  let ganadora = null;
  for (const e of evaluadas) {
    if (e.aplica && (!ganadora || e.total < ganadora.total)) ganadora = e;
  }
  const total = ganadora ? ganadora.total : totalLista;
  return {
    promo: ganadora ? ganadora.promo : null,
    totalLista,
    total,
    descuento: redondear(totalLista - total),
    evaluadas: evaluadas.map((e) => ({ ...e, gana: e === ganadora })),
  };
}

// Simula una venta completa (CU-22) y explica qué promoción aplicó en cada línea y por qué.
function simularVenta(promos, lineas, ctx) {
  const resultado = lineas.map((linea) => {
    const r = mejorPromocion(promos, linea, ctx);
    const etiqueta = `${linea.producto || 'Producto'} · ${linea.sabor || 'Sabor'}`;
    const motivos = r.evaluadas.map((e) => {
      if (e.gana) return `${etiqueta}: «${e.promo.nombre}» aplica y gana (S/ ${e.total.toFixed(2)}).`;
      if (e.aplica) return `${etiqueta}: «${e.promo.nombre}» aplica, pero deja S/ ${e.total.toFixed(2)}, más caro.`;
      return `${etiqueta}: «${e.promo.nombre}» no aplica: ${e.motivo}.`;
    });
    return { ...linea, ...r, motivos };
  });
  const subtotal = redondear(resultado.reduce((a, l) => a + l.totalLista, 0));
  const total = redondear(resultado.reduce((a, l) => a + l.total, 0));
  return {
    lineas: resultado,
    subtotal,
    descuento: redondear(subtotal - total),
    total,
    motivos: resultado.flatMap((l) => l.motivos),
  };
}

module.exports = { DIAS, redondear, totalConPromocion, motivoNoAplica, mejorPromocion, simularVenta };
