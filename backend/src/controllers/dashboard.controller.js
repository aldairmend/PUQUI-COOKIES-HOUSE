const { query, withTransaction } = require('../db/pool');
const { periodo } = require('./comun');
const { composicionStock } = require('../services/turno.service');

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// Variación frente al periodo anterior; null si ese periodo no tiene datos suficientes para comparar.
const variacion = (act, prev, p) =>
  (prev.monto > 0 && prev.dias >= Math.ceil((p.hasta - p.desde) * 0.8) ? Math.round(((act.monto - prev.monto) / prev.monto) * 100) : null);
const r2 = (n) => Math.round(Number(n) * 100) / 100;

// Totales de ventas de un rango de días relativo a hoy (fin exclusivo), opcionalmente de un módulo.
async function totalesVentas(desde, hasta, moduloId) {
  const { rows: [t] } = await query(
    `SELECT COALESCE(SUM(v.monto_total), 0) AS monto, COUNT(*)::int AS ventas,
            COUNT(DISTINCT v.fecha_hora::date)::int AS dias,
            COALESCE((SELECT SUM(vd.cantidad) FROM venta_detalle vd JOIN ventas v2 ON v2.id = vd.venta_id
                       WHERE NOT v2.anulada AND v2.fecha_hora >= CURRENT_DATE + $1::int AND v2.fecha_hora < CURRENT_DATE + $2::int
                         AND ($3::int IS NULL OR v2.modulo_id = $3)), 0)::int AS unidades,
            COALESCE((SELECT SUM(vd.cantidad * vd.precio_unitario) FROM venta_detalle vd JOIN ventas v2 ON v2.id = vd.venta_id
                       WHERE NOT v2.anulada AND v2.fecha_hora >= CURRENT_DATE + $1::int AND v2.fecha_hora < CURRENT_DATE + $2::int
                         AND ($3::int IS NULL OR v2.modulo_id = $3)), 0) AS monto_lista
       FROM ventas v
      WHERE NOT v.anulada AND v.fecha_hora >= CURRENT_DATE + $1::int AND v.fecha_hora < CURRENT_DATE + $2::int
        AND ($3::int IS NULL OR v.modulo_id = $3)`,
    [desde, hasta, moduloId]
  );
  return t;
}

// Serie de ventas por hora (ayer), día (7 días) o semana (30 días).
async function serieVentas(p, moduloId) {
  if (p.clave === 'ayer') {
    const { rows } = await query(
      `SELECT EXTRACT(HOUR FROM fecha_hora)::int AS h, SUM(monto_total) AS monto FROM ventas
        WHERE NOT anulada AND fecha_hora >= CURRENT_DATE - 1 AND fecha_hora < CURRENT_DATE
          AND ($1::int IS NULL OR modulo_id = $1) GROUP BY 1`, [moduloId]);
    const horas = Array.from({ length: 13 }, (_, i) => i + 9);
    return horas.map((h) => ({ label: `${h}h`, valor: r2((rows.find((r) => r.h === h) || {}).monto || 0) }));
  }
  if (p.clave === 'semana') {
    const { rows } = await query(
      `SELECT d::date::text AS fecha, EXTRACT(DOW FROM d)::int AS dow,
              COALESCE((SELECT SUM(monto_total) FROM ventas WHERE NOT anulada AND fecha_hora::date = d::date
                         AND ($1::int IS NULL OR modulo_id = $1)), 0) AS monto
         FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d ORDER BY d`, [moduloId]);
    return rows.map((r) => ({ label: DIAS_CORTOS[r.dow], valor: r2(r.monto) }));
  }
  const { rows } = await query(
    `SELECT ((fecha_hora::date - (CURRENT_DATE - 29)) / 7)::int AS sem, SUM(monto_total) AS monto FROM ventas
      WHERE NOT anulada AND fecha_hora >= CURRENT_DATE - 29 AND fecha_hora < CURRENT_DATE + 1
        AND ($1::int IS NULL OR modulo_id = $1) GROUP BY 1`, [moduloId]);
  return [0, 1, 2, 3, 4].map((s) => ({ label: s === 4 ? 'Últ. 2 días' : `Sem ${s + 1}`, valor: r2((rows.find((r) => r.sem === s) || {}).monto || 0) }));
}

async function ventasPorMedio(p, moduloId) {
  const { rows } = await query(
    `SELECT medio_pago AS medio, COALESCE(SUM(monto_total), 0) AS monto, COUNT(*)::int AS ventas FROM ventas
      WHERE NOT anulada AND fecha_hora >= CURRENT_DATE + $1::int AND fecha_hora < CURRENT_DATE + $2::int
        AND ($3::int IS NULL OR modulo_id = $3) GROUP BY 1`, [p.desde, p.hasta, moduloId]);
  return ['efectivo', 'tarjeta', 'yape'].map((m) => {
    const r = rows.find((x) => x.medio === m) || { monto: 0, ventas: 0 };
    return { medio: m, monto: r2(r.monto), ventas: r.ventas };
  });
}

// Estado actual de cada módulo y sus ventas del periodo.
async function estadoModulos(p) {
  const { rows } = await query(
    `SELECT m.id, m.nombre,
            COALESCE((SELECT SUM(monto_total) FROM ventas v WHERE v.modulo_id = m.id AND NOT v.anulada
                       AND v.fecha_hora >= CURRENT_DATE + $1::int AND v.fecha_hora < CURRENT_DATE + $2::int), 0) AS ventas,
            COALESCE((SELECT SUM(vd.cantidad) FROM venta_detalle vd JOIN ventas v ON v.id = vd.venta_id
                       WHERE v.modulo_id = m.id AND NOT v.anulada
                         AND v.fecha_hora >= CURRENT_DATE + $1::int AND v.fecha_hora < CURRENT_DATE + $2::int), 0)::int AS unidades,
            COALESCE((SELECT SUM(cantidad_actual) FROM v_stock_actual s WHERE s.modulo_id = m.id AND NOT s.debe_devolverse), 0)::int AS stock,
            COALESCE((SELECT SUM(cantidad_actual) FROM v_stock_actual s WHERE s.modulo_id = m.id AND s.debe_devolverse), 0)::int AS por_devolver,
            (SELECT COUNT(*) FROM v_stock_actual s WHERE s.modulo_id = m.id AND s.debe_devolverse)::int AS lotes_devolver,
            (SELECT desajuste FROM turnos t WHERE t.modulo_id = m.id AND t.hora_cierre IS NOT NULL
              ORDER BY t.hora_cierre DESC LIMIT 1) AS desajuste_ultimo,
            (SELECT CASE WHEN t.id IS NULL THEN 'Sin abrir' WHEN t.hora_cierre IS NULL THEN 'Turno abierto' ELSE 'Turno cerrado' END
               FROM (SELECT 1) x LEFT JOIN turnos t ON t.modulo_id = m.id AND t.fecha = CURRENT_DATE
                AND t.tipo = CASE WHEN EXTRACT(HOUR FROM now()::timestamp) >= 16 THEN 'tarde'::tipo_turno ELSE 'manana'::tipo_turno END) AS estado
       FROM modulos m WHERE m.activo ORDER BY m.id`,
    [p.desde, p.hasta]
  );
  return rows.map((r) => ({ ...r, ventas: r2(r.ventas), desajuste_ultimo: r.desajuste_ultimo === null ? null : r2(r.desajuste_ultimo) }));
}

// Dashboard del administrador (RF-30).
async function getAdmin(req, res) {
  const p = periodo(req.query.periodo || 'ayer');
  const moduloId = req.query.modulo_id ? Number(req.query.modulo_id) : null;
  const [act, prev, serie, medios, modulos] = await Promise.all([
    totalesVentas(p.desde, p.hasta, moduloId),
    totalesVentas(p.prevDesde, p.prevHasta, moduloId),
    serieVentas(p, moduloId),
    ventasPorMedio(p, moduloId),
    estadoModulos(p),
  ]);
  const stockModuloId = moduloId || (modulos[0] && modulos[0].id);
  const stock = stockModuloId ? await withTransaction((c) => composicionStock(c, stockModuloId)) : [];

  // Alertas operativas con enlace a la pantalla que debe atenderse.
  const alertas = [];
  modulos.filter((m) => !moduloId || m.id === moduloId).forEach((m) => {
    if (m.por_devolver > 0) {
      alertas.push({ nivel: 'alta', titulo: `${m.nombre} · devoluciones`, texto: `${m.por_devolver} unidades en ${m.lotes_devolver} ${m.lotes_devolver === 1 ? 'lote llegaron' : 'lotes llegaron'} a su día límite y esperan devolución.`, ruta: '/devoluciones', accion: 'Ver devoluciones' });
    }
    if (m.estado === 'Sin abrir') {
      alertas.push({ nivel: 'alta', titulo: `${m.nombre} · caja`, texto: 'Aún no abrió el turno de esta franja, por eso no puede registrar ventas.', ruta: '/caja', accion: 'Ir a Caja' });
    }
    if (m.desajuste_ultimo) {
      alertas.push({ nivel: 'media', titulo: `${m.nombre} · desajuste`, texto: `El último cierre quedó con S/ ${m.desajuste_ultimo.toFixed(2)} de diferencia frente a lo esperado.`, ruta: '/caja', accion: 'Revisar cierre' });
    }
  });
  const nombreStock = (modulos.find((m) => m.id === stockModuloId) || {}).nombre;
  stock.filter((g) => g.venderPrimero && g.venderPrimero.dia > 1 && g.lotes.filter((l) => !l.devolver).length > 1)
    .slice(0, 2)
    .forEach((g) => alertas.push({
      nivel: 'info', titulo: `${g.producto} · ${g.sabor} (${nombreStock})`,
      texto: `Vender primero las ${g.venderPrimero.cantidad} unidades del Día ${g.venderPrimero.dia} antes que las más nuevas (FIFO).`,
      ruta: '/stock', accion: 'Ver stock',
    }));

  const porDevolver = modulos.filter((m) => !moduloId || m.id === moduloId);
  res.json({
    periodo: p.clave,
    titulo_serie: p.titulo,
    kpis: {
      ventas: r2(act.monto), ventas_variacion: variacion(act, prev, p), compara: p.compara,
      unidades: act.unidades, num_ventas: act.ventas,
      precio_medio: act.unidades ? r2(act.monto_lista / act.unidades) : 0,
      por_devolver: porDevolver.reduce((a, m) => a + m.por_devolver, 0),
      lotes_devolver: porDevolver.reduce((a, m) => a + m.lotes_devolver, 0),
    },
    serie,
    medios,
    stock: { modulo_id: stockModuloId, modulo: nombreStock, grupos: stock },
    alertas,
    modulos,
  });
}

// Panel del propietario: ventas, mermas, descuadres y rendimiento de promociones (RF-31).
async function getPropietario(req, res) {
  const p = periodo(req.query.periodo || 'mes');
  const prm = [p.desde, p.hasta];
  const rango = (col) => `${col} >= CURRENT_DATE + $1::int AND ${col} < CURRENT_DATE + $2::int`;
  const [act, prev] = await Promise.all([totalesVentas(p.desde, p.hasta, null), totalesVentas(p.prevDesde, p.prevHasta, null)]);
  const { rows: modulos } = await query(
    `SELECT m.id, m.nombre,
            COALESCE((SELECT SUM(monto_total) FROM ventas v WHERE v.modulo_id = m.id AND NOT v.anulada AND ${rango('v.fecha_hora')}), 0) AS ventas,
            COALESCE((SELECT SUM(vd.cantidad) FROM venta_detalle vd JOIN ventas v ON v.id = vd.venta_id
                       WHERE v.modulo_id = m.id AND NOT v.anulada AND ${rango('v.fecha_hora')}), 0)::int AS vendidas,
            COALESCE((SELECT SUM(d.cantidad) FROM devoluciones d WHERE d.modulo_id = m.id AND ${rango('d.fecha')}), 0)::int AS devueltas,
            COALESCE((SELECT SUM(d.cantidad * p.precio_base) FROM devoluciones d JOIN lotes l ON l.id = d.lote_id
                       JOIN productos p ON p.id = l.producto_id WHERE d.modulo_id = m.id AND ${rango('d.fecha')}), 0) AS merma_valor,
            COALESCE((SELECT SUM(t.desajuste) FROM turnos t WHERE t.modulo_id = m.id AND t.hora_cierre IS NOT NULL AND ${rango('t.fecha')}), 0) AS descuadre,
            (SELECT COUNT(*) FROM turnos t WHERE t.modulo_id = m.id AND t.desajuste <> 0 AND ${rango('t.fecha')})::int AS cierres_descuadrados
       FROM modulos m WHERE m.activo ORDER BY m.id`, prm);
  const { rows: promos } = await query(
    `SELECT pr.id, pr.nombre, pr.activo, COUNT(vd.id)::int AS usos, COALESCE(SUM(vd.descuento), 0) AS descuento
       FROM promociones pr
       LEFT JOIN venta_detalle vd ON vd.promocion_id = pr.id
        AND EXISTS (SELECT 1 FROM ventas v WHERE v.id = vd.venta_id AND NOT v.anulada AND ${rango('v.fecha_hora')})
      GROUP BY pr.id ORDER BY descuento DESC, pr.id`, prm);
  const { rows: sabores } = await query(
    `SELECT p.nombre AS producto, s.nombre AS sabor, SUM(d.cantidad)::int AS unidades
       FROM devoluciones d JOIN lotes l ON l.id = d.lote_id JOIN productos p ON p.id = l.producto_id JOIN sabores s ON s.id = l.sabor_id
      WHERE ${rango('d.fecha')} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5`, prm);

  const mods = modulos.map((m) => ({
    ...m, ventas: r2(m.ventas), merma_valor: r2(m.merma_valor), descuadre: r2(m.descuadre),
    pct_merma: m.vendidas + m.devueltas > 0 ? r2((m.devueltas / (m.vendidas + m.devueltas)) * 100) : 0,
  }));
  const pr = promos.map((x) => ({ ...x, descuento: r2(x.descuento) }));
  const descuentos = r2(pr.reduce((a, x) => a + x.descuento, 0));

  // Sugerencias armadas con los datos reales del periodo.
  const sugerencias = [];
  if (sabores[0]) sugerencias.push(`${sabores[0].sabor} (${sabores[0].producto}) es el sabor con más devoluciones (${sabores[0].unidades} uds): evalúa producir o repartir menos de ese sabor.`);
  const peorMerma = [...mods].sort((a, b) => b.pct_merma - a.pct_merma)[0];
  if (peorMerma && peorMerma.pct_merma > 0) sugerencias.push(`${peorMerma.nombre} tiene la merma más alta (${peorMerma.pct_merma.toFixed(1)}%): ajusta las cantidades que recibe.`);
  const peorCaja = [...mods].sort((a, b) => Math.abs(b.descuadre) - Math.abs(a.descuadre))[0];
  if (peorCaja && peorCaja.descuadre !== 0) sugerencias.push(`${peorCaja.nombre} acumula el mayor descuadre de caja (S/ ${peorCaja.descuadre.toFixed(2)} en ${peorCaja.cierres_descuadrados} cierres): conviene revisar sus cierres de turno.`);
  if (pr[0] && pr[0].descuento > 0) sugerencias.push(`«${pr[0].nombre}» es la promoción que más descuento da (S/ ${pr[0].descuento.toFixed(2)} en ${pr[0].usos} usos): revisa si el aumento de ventas lo compensa.`);
  const mejor = [...mods].sort((a, b) => b.ventas - a.ventas)[0];
  if (mejor && mejor.ventas > 0) sugerencias.push(`${mejor.nombre} es el módulo que más vende (S/ ${mejor.ventas.toFixed(2)}): prioriza su reposición en la ruta.`);

  res.json({
    periodo: p.clave,
    kpis: {
      ventas: r2(act.monto), ventas_variacion: variacion(act, prev, p), compara: p.compara,
      devueltas: mods.reduce((a, m) => a + m.devueltas, 0),
      merma_valor: r2(mods.reduce((a, m) => a + m.merma_valor, 0)),
      descuadre: r2(mods.reduce((a, m) => a + m.descuadre, 0)),
      cierres_descuadrados: mods.reduce((a, m) => a + m.cierres_descuadrados, 0),
      descuentos,
    },
    modulos: mods,
    promociones: pr,
    sabores_devueltos: sabores,
    sugerencias,
  });
}

module.exports = { getAdmin, getPropietario };
