// Datos de demostración (sección 6.2.9): npm run db:seed
// Crea 5 módulos, 9 usuarios, 2 productos con 5 sabores, 4 promociones, el stock actual (con el caso de Nutella)
// y 30 días de historial usando los mismos servicios que la API, para que todo respete las reglas de negocio.
// Los precios, sabores y nombres son de demostración y no son cifras reales de la empresa.
const { pool } = require('../src/db/pool');
const { hashPassword } = require('../src/services/auth.service');
const { registrarVenta, promocionesActivas } = require('../src/services/ventas.service');
const { registrarEntrega, registrarDevolucion } = require('../src/services/lotes.service');
const T = require('../src/services/turno.service');
const { haversine } = require('../src/controllers/asistencia.controller');
const { partesLima } = require('../src/services/tiempo');

const PASSWORD = 'puqui2026';
const DIAS_HISTORIAL = 30;

// Generador pseudoaleatorio con semilla: los datos salen iguales en cada ejecución.
let semilla = 20261007;
const rnd = () => {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const pesoAleatorio = (pares) => {
  const total = pares.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total;
  for (const [v, w] of pares) { x -= w; if (x <= 0) return v; }
  return pares[pares.length - 1][0];
};

const pad = (n) => String(n).padStart(2, '0');
function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const ts = (fecha, min) => `${fecha} ${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;

const MODULOS = [
  { nombre: 'Puqui San Isidro', direccion: 'Av. Javier Prado Oeste 1234, San Isidro', lat: -12.0912, lon: -77.0349, f: 0.28 },
  { nombre: 'Puqui Miraflores', direccion: 'Av. José Larco 890, Miraflores', lat: -12.1268, lon: -77.0297, f: 0.24 },
  { nombre: 'Puqui Surco', direccion: 'Av. Primavera 456, Santiago de Surco', lat: -12.1105, lon: -76.9925, f: 0.18 },
  { nombre: 'Puqui La Molina', direccion: 'Av. La Fontana 321, La Molina', lat: -12.0793, lon: -76.9447, f: 0.16 },
  { nombre: 'Puqui San Borja', direccion: 'Av. San Borja Sur 210, San Borja', lat: -12.1016, lon: -77.0003, f: 0.14 },
];

const USUARIOS = [
  { nombre: 'Rosa Mendoza', email: 'propietaria@puqui.pe', rol: 'propietario' },
  { nombre: 'Jorge Mendoza', email: 'propietario@puqui.pe', rol: 'propietario' },
  { nombre: 'Aldair Mendoza', email: 'admin@puqui.pe', rol: 'administrador' },
  { nombre: 'Luis Pardo', email: 'repartidor@puqui.pe', rol: 'repartidor' },
  { nombre: 'Ana Torres', email: 'ana@puqui.pe', rol: 'vendedor', modulo: 1 },
  { nombre: 'Bruno Salas', email: 'bruno@puqui.pe', rol: 'vendedor', modulo: 2 },
  { nombre: 'Carla Ruiz', email: 'carla@puqui.pe', rol: 'vendedor', modulo: 3 },
  { nombre: 'Diego León', email: 'diego@puqui.pe', rol: 'vendedor', modulo: 4 },
  { nombre: 'Erika Vega', email: 'erika@puqui.pe', rol: 'vendedor', modulo: 5 },
];

const SABORES = ['Chocolate', 'Nutella', 'Red Velvet', 'Vainilla', 'Avena y Pasas'];
const PRODUCTOS = [
  { nombre: 'Cookie Cup', precio: 15, limite: 6, objetivo: 4 },
  { nombre: 'Flat Cookie', precio: 11, limite: 4, objetivo: 5 },
];
// Popularidad relativa de cada sabor (para que la venta y la merma no sean parejas).
const POPULARIDAD = { Chocolate: 5, Nutella: 5, 'Red Velvet': 3, Vainilla: 3, 'Avena y Pasas': 1.2 };

async function limpiar(c) {
  await c.query(`TRUNCATE entregas_turno, asistencias, devoluciones, venta_detalle_lote, venta_detalle, ventas,
    promociones, turnos, lotes, sabores, productos, usuarios, modulos RESTART IDENTITY CASCADE`);
}

async function main() {
  const ahoraLima = partesLima();
  const hoy = ahoraLima.fecha;
  const [hh, mm] = ahoraLima.hora.split(':').map(Number);
  const minutoAhora = hh * 60 + mm;
  const franjaHoy = hh >= 16 ? 'tarde' : 'manana';

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await limpiar(c);

    for (const m of MODULOS) {
      const { rows: [r] } = await c.query(
        'INSERT INTO modulos (nombre, direccion, latitud, longitud, radio_metros) VALUES ($1, $2, $3, $4, 150) RETURNING id',
        [m.nombre, m.direccion, m.lat, m.lon]);
      m.id = r.id;
    }
    const hash = await hashPassword(PASSWORD);
    for (const u of USUARIOS) {
      const { rows: [r] } = await c.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol, modulo_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [u.nombre, u.email, hash, u.rol, u.modulo ? MODULOS[u.modulo - 1].id : null]);
      u.id = r.id;
      u.modulo_id = u.modulo ? MODULOS[u.modulo - 1].id : null;
    }
    const usuario = (email) => USUARIOS.find((u) => u.email === email);
    const admin = usuario('admin@puqui.pe');
    const repartidor = usuario('repartidor@puqui.pe');
    const vendedorDe = (moduloIdx) => USUARIOS.find((u) => u.modulo === moduloIdx + 1);

    const combos = [];
    for (const p of PRODUCTOS) {
      const { rows: [r] } = await c.query(
        'INSERT INTO productos (nombre, precio_base, dias_limite_venta) VALUES ($1, $2, $3) RETURNING id',
        [p.nombre, p.precio, p.limite]);
      p.id = r.id;
      for (const s of SABORES) {
        const { rows: [rs] } = await c.query('INSERT INTO sabores (producto_id, nombre) VALUES ($1, $2) RETURNING id', [p.id, s]);
        combos.push({ producto: p, productoId: p.id, saborId: rs.id, sabor: s, peso: POPULARIDAD[s] });
      }
    }
    const nutellaCup = combos.find((x) => x.producto.nombre === 'Cookie Cup' && x.sabor === 'Nutella');
    const cup = PRODUCTOS[0].id;
    const flat = PRODUCTOS[1].id;

    const promoCreadas = sumarDias(hoy, -DIAS_HISTORIAL - 1);
    const PROMOS = [
      ['Happy hour tarde', null, null, null, '18:00', '20:00', 1, 'porcentaje', 20],
      ['Martes de Cookie Cup', cup, null, 2, null, null, 1, 'precio_fijo', 12],
      ['Lleva 3 Nutella', cup, nutellaCup.saborId, null, null, null, 3, 'monto_fijo', 2],
      ['3x2 en Flat Cookie', flat, null, null, null, null, 3, 'lleva_paga', 2],
    ];
    for (const p of PROMOS) {
      await c.query(
        `INSERT INTO promociones (nombre, producto_id, sabor_id, dia_semana, hora_inicio, hora_fin, cantidad_minima,
                                  tipo_descuento, valor, creado_por, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [...p, usuario('propietaria@puqui.pe').id, `${promoCreadas} 10:00:00`]);
    }
    await c.query('COMMIT');

    const promos = await promocionesActivas(c);
    let totalVentas = 0;

    // Simulación día por día: devoluciones, entregas, turnos, asistencia, ventas y cierres.
    for (let d = -DIAS_HISTORIAL; d <= 0; d++) {
      const fecha = sumarDias(hoy, d);
      const esHoy = d === 0;
      const yaPaso = (min) => !esHoy || min <= minutoAhora;
      const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
      const factorDia = dow === 0 || dow === 6 ? 1.25 : dow === 1 ? 0.85 : 1;
      await c.query('BEGIN');

      for (let mi = 0; mi < MODULOS.length; mi++) {
        const mod = MODULOS[mi];
        const vend = vendedorDe(mi);
        const esSanIsidro = mi === 0;

        // 1) El repartidor recoge lo que llegó a su día límite (hoy quedan pendientes en San Isidro y Surco).
        if (yaPaso(7 * 60 + 30) && !(esHoy && (mi === 0 || mi === 2))) {
          const { rows: pend } = await c.query(
            `SELECT l.id FROM lotes l JOIN productos p ON p.id = l.producto_id
              WHERE l.modulo_id = $1 AND l.estado = 'activo' AND l.cantidad_actual > 0
                AND GREATEST(1, ($2::date - l.fecha_recepcion::date) + 1) >= p.dias_limite_venta`, [mod.id, fecha]);
          for (const l of pend) {
            await registrarDevolucion(c, { loteId: l.id, usuario: repartidor, motivo: 'limite_dias', ahora: ts(fecha, 7 * 60 + 30 + entre(0, 20)) });
          }
        }
        // Caso Nutella del Capítulo 1: se retira lo anterior para dejar 2 del Día 3, 3 del Día 2 y 1 del Día 1.
        if (esSanIsidro && d === -2) {
          const { rows: viejos } = await c.query(
            `SELECT id FROM lotes WHERE modulo_id = $1 AND producto_id = $2 AND sabor_id = $3 AND estado = 'activo' AND cantidad_actual > 0`,
            [mod.id, nutellaCup.productoId, nutellaCup.saborId]);
          for (const l of viejos) {
            await registrarDevolucion(c, { loteId: l.id, usuario: vend, motivo: 'merma', ahora: ts(fecha, 7 * 60 + 50) });
          }
        }

        // 2) Entrega del día: repone cada sabor hasta su objetivo. Hoy faltan Surco y La Molina en la ruta.
        const minEntrega = 8 * 60 + mi * 12;
        if (yaPaso(minEntrega) && !(esHoy && (mi === 2 || mi === 3))) {
          const { rows: stockAct } = await c.query(
            `SELECT l.producto_id, l.sabor_id, SUM(l.cantidad_actual)::int AS cant
               FROM lotes l JOIN productos p ON p.id = l.producto_id
              WHERE l.modulo_id = $1 AND l.estado = 'activo' AND l.cantidad_actual > 0
                AND GREATEST(1, ($2::date - l.fecha_recepcion::date) + 1) < p.dias_limite_venta - 1
              GROUP BY 1, 2`, [mod.id, fecha]);
          const lineas = [];
          for (const cb of combos) {
            const esNutella = esSanIsidro && cb === nutellaCup && d >= -2;
            if (esNutella) {
              lineas.push({ productoId: cb.productoId, saborId: cb.saborId, cantidad: { '-2': 2, '-1': 3, '0': 1 }[String(d)] });
              continue;
            }
            const actual = (stockAct.find((s) => s.producto_id === cb.productoId && s.sabor_id === cb.saborId) || {}).cant || 0;
            const objetivo = Math.round(cb.producto.objetivo * (0.6 + cb.peso / 8) * (0.7 + mod.f * 2));
            const falta = objetivo - actual;
            if (falta >= 3) lineas.push({ productoId: cb.productoId, saborId: cb.saborId, cantidad: falta + entre(0, 2) });
          }
          if (lineas.length) {
            await registrarEntrega(c, { moduloId: mod.id, repartidorId: repartidor.id, lineas, turno: 'manana', ahora: ts(fecha, minEntrega) });
          }
        }

        // 3) Turnos de mañana y tarde.
        for (const tipo of ['manana', 'tarde']) {
          const ini = tipo === 'manana' ? 9 * 60 + 30 : 16 * 60 + 5;
          const fin = tipo === 'manana' ? 15 * 60 + 58 : 21 * 60;
          if (esHoy) {
            if (tipo === 'tarde' && franjaHoy === 'manana') continue;
            if (tipo === franjaHoy && mi === 3) continue; // La Molina aún no abre el turno actual (alerta del dashboard)
          }
          const apertura = esHoy && tipo === franjaHoy ? Math.min(ini, minutoAhora) : ini;
          // Asistencia del vendedor (a veces fuera del radio, rara vez sin marcar).
          const r = rnd();
          if (r > 0.03) {
            const lejos = r > 0.93;
            const dist = lejos ? entre(190, 420) : entre(12, 95);
            const ang = rnd() * 2 * Math.PI;
            const lat = mod.lat + (dist / 111320) * Math.cos(ang);
            const lon = mod.lon + (dist / (111320 * Math.cos((mod.lat * Math.PI) / 180))) * Math.sin(ang);
            const distancia = Math.round(haversine(lat, lon, mod.lat, mod.lon) * 100) / 100;
            await c.query(
              `INSERT INTO asistencias (usuario_id, modulo_id, turno, fecha_hora, latitud, longitud, dentro_rango, distancia_m)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [vend.id, mod.id, tipo, ts(fecha, Math.max(0, apertura - entre(2, 9))), lat, lon, distancia <= 150, distancia]);
          }
          const turno = await T.abrirTurno(c, { moduloId: mod.id, usuarioId: vend.id, efectivoApertura: 100, ahora: ts(fecha, apertura) });

          // Ventas del turno, repartidas en el horario (más en la tarde).
          const hasta = esHoy && tipo === franjaHoy ? Math.min(fin - 5, minutoAhora) : fin - 5;
          const base = 62 * mod.f * factorDia * (tipo === 'manana' ? 0.45 : 0.55);
          const n = Math.max(0, Math.round(base * (0.75 + rnd() * 0.5) * (hasta - apertura) / (fin - 5 - ini)));
          const minutos = Array.from({ length: n }, () => entre(apertura + 1, Math.max(apertura + 1, hasta))).sort((a, b) => a - b);

          const { rows: vendibles } = await c.query(
            `SELECT l.producto_id, l.sabor_id, SUM(l.cantidad_actual)::int AS cant
               FROM lotes l JOIN productos p ON p.id = l.producto_id
              WHERE l.modulo_id = $1 AND l.estado = 'activo' AND l.cantidad_actual > 0
                AND GREATEST(1, ($2::date - l.fecha_recepcion::date) + 1) < p.dias_limite_venta
              GROUP BY 1, 2`, [mod.id, fecha]);
          const disp = new Map(vendibles.map((v) => [`${v.producto_id}|${v.sabor_id}`, v.cant]));

          for (const min of minutos) {
            const items = [];
            const lineas = rnd() < 0.7 ? 1 : 2;
            for (let k = 0; k < lineas; k++) {
              const opciones = combos.filter((cb) => (disp.get(`${cb.productoId}|${cb.saborId}`) || 0) > 0
                && !(esSanIsidro && cb === nutellaCup && d >= -2)
                && !items.some((it) => it.productoId === cb.productoId && it.saborId === cb.saborId));
              if (!opciones.length) break;
              const cb = pesoAleatorio(opciones.map((o) => [o, o.peso]));
              const key = `${cb.productoId}|${cb.saborId}`;
              const cant = Math.min(disp.get(key), pesoAleatorio([[1, 60], [2, 25], [3, 15]]));
              disp.set(key, disp.get(key) - cant);
              items.push({ productoId: cb.productoId, saborId: cb.saborId, cantidad: cant });
            }
            if (!items.length) break;
            const medio = pesoAleatorio([['efectivo', 25], ['tarjeta', 42], ['yape', 33]]);
            await registrarVenta(c, { moduloId: mod.id, usuarioId: vend.id, items, medioPago: medio, ahora: ts(fecha, min), promos });
            totalVentas++;
          }

          // Cierre con algunos descuadres y entrega de turno con la nota para el siguiente.
          if (esHoy && tipo === franjaHoy) continue;
          const { esperado } = await T.resumenTurno(c, turno.id);
          const desajuste = rnd() < 0.82 ? 0 : elegir([-5, -2, -1, -0.5, 0.5, 1, 2]);
          if (tipo === 'manana') {
            await T.entregarTurno(c, {
              turnoId: turno.id, usuarioId: vend.id, ahora: ts(fecha, fin - 3),
              comentario: elegir(['', '', 'Todo en orden.', 'Quedan pocas Cookie Cup de Chocolate.', 'Se acabó el cambio en monedas.']),
            });
          }
          await T.cerrarTurno(c, { turnoId: turno.id, efectivoCierre: Math.max(0, esperado + desajuste), ahora: ts(fecha, fin) });
        }
      }
      await c.query('COMMIT');
    }

    // El administrador también marca asistencia hoy en San Isidro.
    if (minutoAhora >= 9 * 60) {
      await c.query(
        `INSERT INTO asistencias (usuario_id, modulo_id, turno, fecha_hora, latitud, longitud, dentro_rango, distancia_m)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, 30)`,
        [admin.id, MODULOS[0].id, franjaHoy, ts(hoy, Math.min(minutoAhora, 9 * 60 + 10)), MODULOS[0].lat + 0.00027, MODULOS[0].lon]);
    }

    const { rows: [res] } = await c.query(
      `SELECT (SELECT COUNT(*) FROM ventas) AS ventas, (SELECT COUNT(*) FROM lotes) AS lotes,
              (SELECT COUNT(*) FROM devoluciones) AS devoluciones, (SELECT COUNT(*) FROM turnos) AS turnos,
              (SELECT COUNT(*) FROM asistencias) AS asistencias`);
    console.log(`Datos de demostración creados: ${res.ventas} ventas, ${res.lotes} lotes, ${res.devoluciones} devoluciones, ${res.turnos} turnos y ${res.asistencias} marcaciones.`);
    console.log(`Usuarios (contraseña "${PASSWORD}"):`);
    USUARIOS.forEach((u) => console.log(`  ${u.rol.padEnd(13)} ${u.email.padEnd(22)} ${u.nombre}${u.modulo ? ' · ' + MODULOS[u.modulo - 1].nombre : ''}`));
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('No se pudieron crear los datos de demostración:', err);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}

main();
