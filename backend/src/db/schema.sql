-- Esquema de la base de datos de Puqui Cookies House (PostgreSQL 14+).
-- Es idempotente: se puede ejecutar varias veces sin perder datos.
-- Las fechas se guardan en hora local de Lima (la conexión fija timezone = America/Lima).

DO $$ BEGIN
  CREATE TYPE rol_usuario AS ENUM ('propietario', 'administrador', 'vendedor', 'repartidor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medio_pago AS ENUM ('efectivo', 'tarjeta', 'yape');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_turno AS ENUM ('manana', 'tarde');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_lote AS ENUM ('activo', 'agotado', 'devuelto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_descuento AS ENUM ('porcentaje', 'monto_fijo', 'precio_fijo', 'lleva_paga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS modulos (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  direccion     VARCHAR(200),
  latitud       DOUBLE PRECISION,
  longitud      DOUBLE PRECISION,
  radio_metros  INTEGER NOT NULL DEFAULT 150,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(200) NOT NULL,
  rol            rol_usuario NOT NULL,
  modulo_id      INTEGER REFERENCES modulos(id),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id                 SERIAL PRIMARY KEY,
  nombre             VARCHAR(100) NOT NULL,
  precio_base        NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0),
  dias_limite_venta  INTEGER NOT NULL CHECK (dias_limite_venta >= 1),
  activo             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sabores (
  id           SERIAL PRIMARY KEY,
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  nombre       VARCHAR(100) NOT NULL,
  activo       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS lotes (
  id                SERIAL PRIMARY KEY,
  producto_id       INTEGER NOT NULL REFERENCES productos(id),
  sabor_id          INTEGER NOT NULL REFERENCES sabores(id),
  modulo_id         INTEGER NOT NULL REFERENCES modulos(id),
  repartidor_id     INTEGER REFERENCES usuarios(id),
  cantidad_inicial  INTEGER NOT NULL CHECK (cantidad_inicial > 0),
  cantidad_actual   INTEGER NOT NULL CHECK (cantidad_actual >= 0),
  fecha_recepcion   TIMESTAMP NOT NULL DEFAULT now(),
  turno_recepcion   tipo_turno NOT NULL,
  estado            estado_lote NOT NULL DEFAULT 'activo',
  creado_en         TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (cantidad_actual <= cantidad_inicial)
);
CREATE INDEX IF NOT EXISTS idx_lotes_fifo ON lotes (modulo_id, producto_id, sabor_id, fecha_recepcion) WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS turnos (
  id                 SERIAL PRIMARY KEY,
  modulo_id          INTEGER NOT NULL REFERENCES modulos(id),
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id),
  tipo               tipo_turno NOT NULL,
  fecha              DATE NOT NULL,
  hora_apertura      TIMESTAMP NOT NULL DEFAULT now(),
  hora_cierre        TIMESTAMP,
  efectivo_apertura  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (efectivo_apertura >= 0),
  efectivo_cierre    NUMERIC(10,2),
  efectivo_esperado  NUMERIC(10,2),
  desajuste          NUMERIC(10,2),
  UNIQUE (modulo_id, fecha, tipo)
);

CREATE TABLE IF NOT EXISTS ventas (
  id           SERIAL PRIMARY KEY,
  modulo_id    INTEGER NOT NULL REFERENCES modulos(id),
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
  turno_id     INTEGER NOT NULL REFERENCES turnos(id),
  fecha_hora   TIMESTAMP NOT NULL DEFAULT now(),
  medio_pago   medio_pago NOT NULL,
  monto_total  NUMERIC(10,2) NOT NULL CHECK (monto_total >= 0),
  anulada      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas (turno_id);

CREATE TABLE IF NOT EXISTS promociones (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(150) NOT NULL,
  producto_id      INTEGER REFERENCES productos(id),
  sabor_id         INTEGER REFERENCES sabores(id),
  dia_semana       SMALLINT CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio      TIME,
  hora_fin         TIME,
  cantidad_minima  INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_minima >= 1),
  tipo_descuento   tipo_descuento NOT NULL,
  valor            NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por       INTEGER REFERENCES usuarios(id),
  creado_en        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id               SERIAL PRIMARY KEY,
  venta_id         INTEGER NOT NULL REFERENCES ventas(id),
  producto_id      INTEGER NOT NULL REFERENCES productos(id),
  sabor_id         INTEGER NOT NULL REFERENCES sabores(id),
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(10,2) NOT NULL,
  descuento        NUMERIC(10,2) NOT NULL DEFAULT 0,
  promocion_id     INTEGER REFERENCES promociones(id)
);
CREATE INDEX IF NOT EXISTS idx_detalle_venta ON venta_detalle (venta_id);

CREATE TABLE IF NOT EXISTS venta_detalle_lote (
  id                SERIAL PRIMARY KEY,
  venta_detalle_id  INTEGER NOT NULL REFERENCES venta_detalle(id),
  lote_id           INTEGER NOT NULL REFERENCES lotes(id),
  cantidad_tomada   INTEGER NOT NULL CHECK (cantidad_tomada > 0)
);
CREATE INDEX IF NOT EXISTS idx_vdl_detalle ON venta_detalle_lote (venta_detalle_id);

CREATE TABLE IF NOT EXISTS devoluciones (
  id          SERIAL PRIMARY KEY,
  lote_id     INTEGER NOT NULL REFERENCES lotes(id),
  modulo_id   INTEGER NOT NULL REFERENCES modulos(id),
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  cantidad    INTEGER NOT NULL CHECK (cantidad > 0),
  motivo      VARCHAR(50) NOT NULL DEFAULT 'limite_dias',
  fecha       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asistencias (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  modulo_id     INTEGER NOT NULL REFERENCES modulos(id),
  turno         tipo_turno NOT NULL,
  fecha_hora    TIMESTAMP NOT NULL DEFAULT now(),
  latitud       DOUBLE PRECISION,
  longitud      DOUBLE PRECISION,
  dentro_rango  BOOLEAN NOT NULL,
  distancia_m   NUMERIC(8,2)
);

CREATE TABLE IF NOT EXISTS entregas_turno (
  id          SERIAL PRIMARY KEY,
  turno_id    INTEGER NOT NULL REFERENCES turnos(id),
  modulo_id   INTEGER NOT NULL REFERENCES modulos(id),
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  nota        JSONB NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT now()
);

-- Lotes activos con unidades y su día de antigüedad (reemplaza la hojita).
-- Día = días transcurridos desde la recepción + 1. Al llegar al límite del producto deja de venderse.
CREATE OR REPLACE VIEW v_stock_actual AS
SELECT
  l.id               AS lote_id,
  l.modulo_id,
  m.nombre           AS modulo,
  l.producto_id,
  p.nombre           AS producto,
  l.sabor_id,
  s.nombre           AS sabor,
  l.cantidad_inicial,
  l.cantidad_actual,
  l.fecha_recepcion,
  l.turno_recepcion,
  GREATEST(1, (CURRENT_DATE - l.fecha_recepcion::date) + 1) AS dia,
  p.dias_limite_venta AS dia_limite,
  GREATEST(1, (CURRENT_DATE - l.fecha_recepcion::date) + 1) >= p.dias_limite_venta AS debe_devolverse
FROM lotes l
JOIN productos p ON p.id = l.producto_id
JOIN sabores s   ON s.id = l.sabor_id
JOIN modulos m   ON m.id = l.modulo_id
WHERE l.estado = 'activo' AND l.cantidad_actual > 0;

-- Por cada unidad vendida: de qué lote salió y qué día tenía ese lote al venderse.
CREATE OR REPLACE VIEW v_historial_rotacion AS
SELECT
  v.id                AS venta_id,
  v.modulo_id,
  v.turno_id,
  t.tipo              AS turno,
  v.fecha_hora,
  vd.producto_id,
  p.nombre            AS producto,
  vd.sabor_id,
  s.nombre            AS sabor,
  vdl.lote_id,
  l.fecha_recepcion,
  GREATEST(1, (v.fecha_hora::date - l.fecha_recepcion::date) + 1) AS dia_al_vender,
  vdl.cantidad_tomada
FROM venta_detalle_lote vdl
JOIN venta_detalle vd ON vd.id = vdl.venta_detalle_id
JOIN ventas v         ON v.id = vd.venta_id AND NOT v.anulada
JOIN turnos t         ON t.id = v.turno_id
JOIN lotes l          ON l.id = vdl.lote_id
JOIN productos p      ON p.id = vd.producto_id
JOIN sabores s        ON s.id = vd.sabor_id;
