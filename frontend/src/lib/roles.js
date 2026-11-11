// Matriz de permisos por rol y pantalla (Tabla 32) y textos de ayuda por rol (RNF-02).
// El servidor vuelve a validar cada operación: esto solo decide qué se muestra.

export const ROLES = {
  propietario: { nombre: 'Propietario', inicio: '/panel' },
  administrador: { nombre: 'Administrador', inicio: '/dashboard' },
  vendedor: { nombre: 'Vendedor', inicio: '/mi-turno' },
  repartidor: { nombre: 'Repartidor', inicio: '/mi-ruta' },
};

// acceso: 'completo' | 'ver' | 'propio' (su módulo / su turno / lo suyo)
export const PANTALLAS = [
  { path: '/dashboard', grupo: 'Principal', icono: 'grid', titulo: 'Dashboard', roles: { administrador: 'completo' } },
  { path: '/panel', grupo: 'Principal', icono: 'grid', titulo: 'Panel', roles: { propietario: 'completo' } },
  { path: '/mi-turno', grupo: 'Principal', icono: 'home', titulo: 'Mi turno', roles: { vendedor: 'propio' } },
  { path: '/mi-ruta', grupo: 'Principal', icono: 'ruta', titulo: 'Mi ruta', roles: { repartidor: 'completo' } },
  { path: '/ventas', grupo: 'Principal', icono: 'carrito', titulo: 'Ventas', roles: { administrador: 'completo', vendedor: 'propio' } },
  { path: '/aplicador', grupo: 'Principal', icono: 'porcentaje', titulo: 'Aplicador de promociones', roles: { propietario: 'completo', administrador: 'completo' } },
  { path: '/stock', grupo: 'Inventario', icono: 'caja', titulo: 'Stock', roles: { propietario: 'ver', administrador: 'completo', vendedor: 'propio' } },
  {
    path: '/distribucion', grupo: 'Inventario', icono: 'camion', titulo: 'Distribución',
    titulos: { vendedor: 'Recepción', repartidor: 'Entregas' },
    roles: { propietario: 'ver', administrador: 'completo', vendedor: 'propio', repartidor: 'completo' },
  },
  {
    path: '/devoluciones', grupo: 'Inventario', icono: 'devolver', titulo: 'Devoluciones',
    titulos: { repartidor: 'Recojo de devoluciones' },
    roles: { propietario: 'ver', administrador: 'completo', vendedor: 'propio', repartidor: 'completo' },
  },
  { path: '/caja', grupo: 'Gestión', icono: 'billete', titulo: 'Caja', roles: { propietario: 'ver', administrador: 'completo', vendedor: 'propio' } },
  { path: '/promociones', grupo: 'Gestión', icono: 'etiqueta', titulo: 'Promociones', roles: { propietario: 'completo', administrador: 'completo', vendedor: 'ver' } },
  { path: '/asistencia', grupo: 'Gestión', icono: 'ubicacion', titulo: 'Asistencia', roles: { propietario: 'ver', administrador: 'completo', vendedor: 'propio' } },
  { path: '/reportes', grupo: 'Gestión', icono: 'barras', titulo: 'Reportes', roles: { propietario: 'completo', administrador: 'completo' } },
];

export const acceso = (rol, path) => (PANTALLAS.find((p) => p.path === path) || { roles: {} }).roles[rol] || null;
export const puedeOperar = (rol, path) => ['completo', 'propio'].includes(acceso(rol, path));
export const tituloPara = (pantalla, rol) => (pantalla.titulos && pantalla.titulos[rol]) || pantalla.titulo;
export const menuDe = (rol) => PANTALLAS.filter((p) => p.roles[rol]);

// «Qué haces en esta pantalla», por pantalla y rol.
export const AYUDA = {
  '/dashboard': {
    administrador: 'Revisas el estado de los 5 módulos de un vistazo: ventas, stock por sabor y día, alertas (devoluciones, cajas sin abrir, descuadres) y el estado de cada módulo. Desde aquí saltas a la pantalla que necesita atención.',
  },
  '/panel': {
    propietario: 'Ves cómo va el negocio completo: ventas por módulo, mermas, descuadres de caja y rendimiento de las promociones. No operas el punto de venta; esta pantalla sirve para decidir.',
  },
  '/mi-turno': {
    vendedor: 'Es tu inicio: ves qué vender primero, las ventas del turno y haces la entrega de turno (la nota que reemplaza la hojita).',
  },
  '/mi-ruta': {
    repartidor: 'Es tu inicio: recorres los módulos, registras la entrega sabor por sabor y marcas lo que recoges para devolución.',
  },
  '/ventas': {
    administrador: 'Puedes vender en cualquier módulo (eliges el módulo arriba). El sistema descuenta el stock del lote más antiguo y aplica las promociones vigentes.',
    vendedor: 'Toca un sabor para agregarlo. El stock se descuenta solo, del lote más antiguo al más nuevo, y las promociones vigentes se aplican en el carrito.',
  },
  '/aplicador': {
    propietario: 'Pruebas cómo se aplicaría una promoción a una venta antes de que afecte a un cliente: eliges día, hora y productos, y ves qué regla gana y por qué.',
    administrador: 'Pruebas cómo se aplicaría una promoción a una venta: eliges día, hora y productos, y ves qué regla gana y por qué.',
  },
  '/stock': {
    propietario: 'Consultas la composición por sabor y día de cualquier módulo y el historial de rotación. Es solo para ver.',
    administrador: 'Controlas la composición por sabor y día de cualquier módulo y consultas el historial de rotación. Ves qué lote sale primero y cuáles hay que devolver.',
    vendedor: 'Ves el stock de tu módulo por sabor y día: qué lote sale primero y cuál ya debe devolverse. Reemplaza la hojita.',
  },
  '/distribucion': {
    propietario: 'Consultas los lotes que llegaron a cada módulo. Es solo para ver.',
    administrador: 'Registras lo que llega a cualquier módulo. Cada sabor entra como un lote nuevo en Día 1; el stock anterior sigue su propia rotación.',
    vendedor: 'Registras lo que llegó a tu módulo, sabor por sabor. Cada sabor entra como un lote nuevo en Día 1.',
    repartidor: 'Registras lo que entregas en cada módulo, sabor por sabor. Cada entrega entra como Día 1.',
  },
  '/devoluciones': {
    propietario: 'Consultas los lotes por devolver y el historial de devoluciones. Es solo para ver.',
    administrador: 'Pasas a devolución los lotes que llegaron a su día límite en cualquier módulo y revisas el historial.',
    vendedor: 'Marcas para devolución los lotes de tu módulo que llegaron a su día límite.',
    repartidor: 'Ves los lotes de todos los módulos que llegaron a su día límite y los marcas como recogidos.',
  },
  '/caja': {
    propietario: 'Consultas los turnos de caja y sus desajustes. Es solo para ver.',
    administrador: 'Abres y cierras turnos de cualquier módulo y revisas los desajustes.',
    vendedor: 'Abres tu turno con el efectivo inicial y lo cierras contando el efectivo. El sistema calcula lo esperado y el desajuste.',
  },
  '/promociones': {
    propietario: 'Creas las reglas de promoción (producto, sabor, día, horario y cantidad) y desactivas las que ya no van. Se aplican solas al vender.',
    administrador: 'Creas y desactivas promociones. Se aplican solas al vender.',
    vendedor: 'Ves las promociones activas. Se aplican solas en el carrito; no tienes que calcular nada.',
  },
  '/asistencia': {
    propietario: 'Ves al personal de hoy en todos los módulos: quién marcó, a qué distancia y quién no marcó.',
    administrador: 'Marcas tu asistencia y controlas la del personal de todos los módulos: quién marcó, a qué distancia y quién no marcó.',
    vendedor: 'Marcas tu llegada con la ubicación del celular. Reemplaza el envío de ubicación por WhatsApp.',
  },
  '/reportes': {
    propietario: 'Revisas los consolidados del negocio: ventas por medio de pago, por producto y sabor, devoluciones y caja.',
    administrador: 'Revisas los consolidados de ventas, devoluciones y caja de todos los módulos o de uno.',
  },
};
