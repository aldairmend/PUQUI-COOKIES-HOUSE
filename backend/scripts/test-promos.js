// Pruebas unitarias del motor de promociones (Tabla 33, PU-01 a PU-11). Ejecutar con: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { totalConPromocion, mejorPromocion, simularVenta } = require('../src/services/promociones.service');

const FLAT = { productoId: 2, producto: 'Flat Cookie', precioLista: 11 };
const CUP = { productoId: 1, producto: 'Cookie Cup', precioLista: 15 };
const NUTELLA = 2; // id del sabor Nutella de Cookie Cup en los datos de prueba

const P3x2 = { id: 4, nombre: '3x2 en Flat Cookie', producto_id: 2, sabor_id: null, dia_semana: null, hora_inicio: null, hora_fin: null, cantidad_minima: 3, tipo_descuento: 'lleva_paga', valor: 2 };
const NUTE = { id: 3, nombre: 'Lleva 3 Nutella', producto_id: 1, sabor_id: NUTELLA, dia_semana: null, hora_inicio: null, hora_fin: null, cantidad_minima: 3, tipo_descuento: 'monto_fijo', valor: 2 };
const MARTES = { id: 2, nombre: 'Martes de Cookie Cup', producto_id: 1, sabor_id: null, dia_semana: 2, hora_inicio: null, hora_fin: null, cantidad_minima: 1, tipo_descuento: 'precio_fijo', valor: 12 };
const HAPPY = { id: 1, nombre: 'Happy hour tarde', producto_id: null, sabor_id: null, dia_semana: null, hora_inicio: '18:00:00', hora_fin: '20:00:00', cantidad_minima: 1, tipo_descuento: 'porcentaje', valor: 20 };

const MIERCOLES_MANANA = { diaSemana: 3, hora: '10:00' };

test('PU-01 3x2: 3 Flat Cookie cuesta S/ 22 con 1 unidad gratis', () => {
  assert.equal(totalConPromocion(P3x2, 11, 3), 22);
});

test('PU-02 3x2: 4 Flat Cookie cuesta S/ 33 (una gratis, no un porcentaje parejo)', () => {
  assert.equal(totalConPromocion(P3x2, 11, 4), 33);
});

test('PU-03 3x2: 6 Flat Cookie cuesta S/ 44 con 2 unidades gratis', () => {
  assert.equal(totalConPromocion(P3x2, 11, 6), 44);
});

test('PU-04 3x2 con 2 unidades (menos del mínimo) no aplica', () => {
  const r = mejorPromocion([P3x2], { ...FLAT, saborId: 7, cantidad: 2 }, MIERCOLES_MANANA);
  assert.equal(r.promo, null);
  assert.equal(r.total, 22);
});

test('PU-05 «Lleva 3 Nutella»: 3 Cookie Cup Nutella cuestan S/ 39', () => {
  const r = mejorPromocion([NUTE], { ...CUP, saborId: NUTELLA, cantidad: 3 }, MIERCOLES_MANANA);
  assert.equal(r.promo.id, 3);
  assert.equal(r.total, 39);
});

test('PU-06 Precio fijo de S/ 12 solo los martes', () => {
  const linea = { ...CUP, saborId: 1, cantidad: 1 };
  assert.equal(mejorPromocion([MARTES], linea, { diaSemana: 2, hora: '10:00' }).total, 12);
  assert.equal(mejorPromocion([MARTES], linea, { diaSemana: 4, hora: '10:00' }).total, 15);
});

test('PU-07 20% solo de 18:00 a 20:00', () => {
  const linea = { ...CUP, saborId: 1, cantidad: 1 };
  assert.equal(mejorPromocion([HAPPY], linea, { diaSemana: 3, hora: '18:30' }).total, 12);
  assert.equal(mejorPromocion([HAPPY], linea, { diaSemana: 3, hora: '20:30' }).total, 15);
});

test('PU-08 3 Flat Cookie a las 18:30: gana el 3x2 (S/ 22) y no el 20% (S/ 26.40)', () => {
  const r = mejorPromocion([HAPPY, P3x2], { ...FLAT, saborId: 7, cantidad: 3 }, { diaSemana: 3, hora: '18:30' });
  assert.equal(r.promo.id, 4);
  assert.equal(r.total, 22);
  const happy = r.evaluadas.find((e) => e.promo.id === 1);
  assert.equal(happy.total, 26.4);
});

test('PU-09 Martes con 3 Cookie Cup Nutella: gana el precio fijo (S/ 36 frente a S/ 39)', () => {
  const r = mejorPromocion([NUTE, MARTES], { ...CUP, saborId: NUTELLA, cantidad: 3 }, { diaSemana: 2, hora: '10:00' });
  assert.equal(r.promo.id, 2);
  assert.equal(r.total, 36);
});

test('PU-10 Una promoción mal configurada que subiría el precio no se aplica', () => {
  const mala = { id: 9, nombre: 'Precio mal puesto', producto_id: 2, sabor_id: null, dia_semana: null, hora_inicio: null, hora_fin: null, cantidad_minima: 1, tipo_descuento: 'precio_fijo', valor: 15 };
  const r = mejorPromocion([mala], { ...FLAT, saborId: 7, cantidad: 1 }, MIERCOLES_MANANA);
  assert.equal(r.promo, null);
  assert.equal(r.total, 11);
});

test('PU-11 Simulación de una venta de 63 soles: total 52, descuento 11 y motivos', () => {
  const sim = simularVenta(
    [HAPPY, MARTES, NUTE, P3x2],
    [
      { ...FLAT, saborId: 7, sabor: 'Chocolate', cantidad: 3 },
      { ...CUP, saborId: 1, sabor: 'Chocolate', cantidad: 2 },
    ],
    MIERCOLES_MANANA
  );
  assert.equal(sim.subtotal, 63);
  assert.equal(sim.total, 52);
  assert.equal(sim.descuento, 11);
  assert.ok(sim.motivos.some((m) => m.includes('3x2') && m.includes('gana')));
  assert.ok(sim.motivos.some((m) => m.includes('Happy hour') && m.includes('no aplica')));
});
