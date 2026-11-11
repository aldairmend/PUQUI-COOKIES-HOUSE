const { query } = require('../db/pool');
const { invalido, noEncontrado } = require('../services/errores');

// Distancia en metros entre dos puntos con la fórmula de Haversine (curvatura de la Tierra).
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Marca la asistencia con la ubicación del dispositivo y verifica el radio del módulo (RN-10).
async function postAsistencia(req, res) {
  const b = req.body || {};
  const lat = Number(b.latitud);
  const lon = Number(b.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw invalido('No se recibió una ubicación válida. Permite el acceso a la ubicación e intenta de nuevo.');
  }
  if (!req.moduloId) throw invalido('Elige el módulo donde marcas asistencia.');
  const { rows: [m] } = await query('SELECT * FROM modulos WHERE id = $1 AND activo', [req.moduloId]);
  if (!m) throw noEncontrado('El módulo');
  const distancia = Math.round(haversine(lat, lon, m.latitud, m.longitud) * 100) / 100;
  const dentro = distancia <= m.radio_metros;
  const { rows: [a] } = await query(
    `INSERT INTO asistencias (usuario_id, modulo_id, turno, latitud, longitud, dentro_rango, distancia_m)
     VALUES ($1, $2, CASE WHEN EXTRACT(HOUR FROM now()::timestamp) >= 16 THEN 'tarde'::tipo_turno ELSE 'manana'::tipo_turno END,
             $3, $4, $5, $6) RETURNING *`,
    [req.usuario.id, m.id, lat, lon, dentro, distancia]
  );
  res.status(201).json({ ...a, modulo: m.nombre, radio_metros: m.radio_metros });
}

// Personal de hoy en todos los módulos: quién marcó, a qué distancia y quién no (RF-26).
async function getHoy(req, res) {
  const { rows } = await query(
    `SELECT u.id AS usuario_id, u.nombre, u.rol, COALESCE(a.modulo_id, u.modulo_id) AS modulo_id,
            m.nombre AS modulo, a.turno, a.fecha_hora, a.distancia_m, a.dentro_rango
       FROM usuarios u
       LEFT JOIN LATERAL (
         SELECT * FROM asistencias x WHERE x.usuario_id = u.id AND x.fecha_hora::date = CURRENT_DATE
          ORDER BY x.fecha_hora DESC LIMIT 1
       ) a ON TRUE
       LEFT JOIN modulos m ON m.id = COALESCE(a.modulo_id, u.modulo_id)
      WHERE u.activo AND (u.rol = 'vendedor' OR a.id IS NOT NULL)
      ORDER BY m.id NULLS LAST, u.nombre`
  );
  res.json(rows);
}

// Marcaciones recientes: el vendedor solo ve las suyas (soloPropio).
async function getAsistencias(req, res) {
  const usuarioId = req.soloUsuarioId || (req.query.usuario_id ? Number(req.query.usuario_id) : null);
  const limite = Math.min(Number(req.query.limit) || 15, 200);
  const { rows } = await query(
    `SELECT a.id, a.usuario_id, u.nombre, a.modulo_id, m.nombre AS modulo, a.turno, a.fecha_hora,
            a.distancia_m, a.dentro_rango
       FROM asistencias a JOIN usuarios u ON u.id = a.usuario_id JOIN modulos m ON m.id = a.modulo_id
      WHERE ($1::int IS NULL OR a.usuario_id = $1)
      ORDER BY a.fecha_hora DESC LIMIT $2`,
    [usuarioId, limite]
  );
  res.json(rows);
}

module.exports = { haversine, postAsistencia, getHoy, getAsistencias };
