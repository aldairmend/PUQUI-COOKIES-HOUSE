// Reglas de promociones del lado del cliente: la misma lógica que backend/src/services/promociones.service.js.
// Sirve para mostrar en el carrito el precio que cobrará el servidor; el servidor siempre recalcula.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

export function totalConPromocion(promo, precioLista, cantidad) {
  const valor = Number(promo.valor);
  switch (promo.tipo_descuento) {
    case 'porcentaje':
      return redondear(precioLista * (1 - valor / 100) * cantidad);
    case 'monto_fijo':
      return redondear(Math.max(0, precioLista - valor) * cantidad);
    case 'precio_fijo':
      return redondear(valor * cantidad);
    case 'lleva_paga': {
      const lleva = Number(promo.cantidad_minima);
      const gratis = Math.floor(cantidad / lleva) * Math.max(0, lleva - valor);
      return redondear(precioLista * (cantidad - Math.min(gratis, cantidad)));
    }
    default:
      return redondear(precioLista * cantidad);
  }
}

// Condiciones de día y hora (sin mirar producto ni cantidad): sirve para listar las promociones vigentes ahora.
export function vigenteAhora(promo, ctx) {
  if (promo.activo === false) return false;
  if (promo.dia_semana !== null && promo.dia_semana !== undefined && Number(promo.dia_semana) !== Number(ctx.diaSemana)) return false;
  const ini = hhmm(promo.hora_inicio);
  const fin = hhmm(promo.hora_fin);
  const hora = hhmm(ctx.hora);
  return !((ini && hora < ini) || (fin && hora >= fin));
}

export function mejorPromocion(promos, linea, ctx) {
  const precioLista = Number(linea.precioLista);
  const totalLista = redondear(precioLista * linea.cantidad);
  let ganadora = null;
  for (const promo of promos) {
    if (!vigenteAhora(promo, ctx)) continue;
    if (promo.producto_id && Number(promo.producto_id) !== Number(linea.productoId)) continue;
    if (promo.sabor_id && Number(promo.sabor_id) !== Number(linea.saborId)) continue;
    if (linea.cantidad < Number(promo.cantidad_minima || 1)) continue;
    const total = totalConPromocion(promo, precioLista, linea.cantidad);
    if (total < totalLista && (!ganadora || total < ganadora.total)) ganadora = { promo, total };
  }
  const total = ganadora ? ganadora.total : totalLista;
  return { promo: ganadora ? ganadora.promo : null, totalLista, total, descuento: redondear(totalLista - total) };
}

export function describirPromo(p) {
  const v = Number(p.valor);
  const tipo = {
    porcentaje: `${v}% de descuento`,
    monto_fijo: `S/ ${v.toFixed(2)} menos por unidad`,
    precio_fijo: `a S/ ${v.toFixed(2)} cada una`,
    lleva_paga: `lleva ${p.cantidad_minima}, paga ${v}`,
  }[p.tipo_descuento];
  const partes = [];
  partes.push(p.producto_nombre ? `${p.producto_nombre}${p.sabor_nombre ? ' ' + p.sabor_nombre : ''}` : 'Todos los productos');
  if (p.dia_semana !== null && p.dia_semana !== undefined) partes.push(`solo los ${DIAS[p.dia_semana]}`);
  if (p.hora_inicio || p.hora_fin) partes.push(`de ${hhmm(p.hora_inicio) || '00:00'} a ${hhmm(p.hora_fin) || '24:00'}`);
  if (p.tipo_descuento !== 'lleva_paga' && Number(p.cantidad_minima) > 1) partes.push(`desde ${p.cantidad_minima} unidades`);
  return `${tipo} · ${partes.join(' · ')}`;
}
