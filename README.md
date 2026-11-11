# Puqui Cookies House · Sistema de gestión

Sistema web (PWA) de gestión y trazabilidad de ventas y stock por sabor y día para los 5 módulos de Puqui Cookies House. Implementa el producto descrito en el documento del trabajo de investigación (capítulos 4 a 6). Reemplaza la «hojita», el Excel de ventas, el Excel de conteo y los mensajes de WhatsApp.

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js 18+ · Express 4.19 · pg 8.12 · bcryptjs · jsonwebtoken (JWT de 12 h) |
| Base de datos | PostgreSQL 14+ (13 tablas, 2 vistas, 5 tipos enumerados) |
| Frontend | React 18.3 · React Router 6.26 · Vite 5.4 · PWA (manifiesto + service worker) |

## Qué incluye

**4 roles** con su propia pantalla de inicio y permisos validados en el servidor (Tabla 32):

| Rol | Inicio | Qué hace |
| --- | --- | --- |
| Propietario | Panel | Ve ventas, mermas, descuadres y rendimiento de promociones; crea promociones; el resto solo lo consulta. |
| Administrador | Dashboard | Opera y supervisa los 5 módulos. |
| Vendedor | Mi turno | Vende, recibe mercadería, abre y cierra caja, marca asistencia y entrega el turno, **solo en su módulo**. |
| Repartidor | Mi ruta | Registra entregas sabor por sabor y recoge las devoluciones de todos los módulos. |

**14 pantallas:** Inicio de sesión, Dashboard, Panel del propietario, Mi turno, Mi ruta, Ventas, Aplicador de promociones, Stock por sabor y día, Distribución (Entregas/Recepción), Devoluciones, Caja, Promociones, Asistencia y Reportes.

**Reglas de negocio (RN-01 a RN-12)**:
- Cada entrega crea un lote en Día 1.
- Las ventas descuentan stock con **FIFO** (primero el lote más antiguo). Las filas se bloquean para que dos ventas simultáneas no descuenten el mismo stock.
- Un lote que llega a su día límite (Día 4 en Flat Cookie, Día 6 en Cookie Cup) deja de venderse y pasa a devolución.
- Solo se puede vender con un turno abierto. El turno de tarde empieza a las 16:00, en hora de Lima.
- Cuando aplican varias promociones, gana la que deja el menor total, incluido «lleva N, paga M».
- La caja calcula el efectivo esperado y el desajuste al cerrar.
- La asistencia se verifica con geolocalización y la fórmula de Haversine.
- La entrega de turno guarda una nota con el stock por sabor y día, que ve el turno siguiente.
- Cada unidad vendida queda ligada a su lote de origen, lo que da el **historial de rotación**.

## Estructura

```
backend/                API Node.js + Express
  src/db/               schema.sql, migrations.js, pool.js
  src/services/         fifo, promociones, turno, auth, ventas, lotes
  src/controllers/      12 controladores (uno por módulo)
  src/middleware/       auth.js (requireAuth, requireRol, scopeModulo, usuarioDeToken, soloPropio), errorHandler.js
  src/routes/index.js   35 rutas (Tabla 28)
  scripts/              apply-schema, seed, test-promos
frontend/               PWA React + Vite
  src/pages/            14 pantallas
  src/components/       Layout, ui, Planilla
  src/hooks/            useApi, useModulo
  src/lib/              roles, promo, format
  public/               manifest, service worker, íconos
```

## Cómo ejecutarlo en tu computadora

### 1. Requisitos

- [Node.js](https://nodejs.org) 18 o superior.
- [PostgreSQL](https://www.postgresql.org/download/) 14 o superior. En Windows, el instalador incluye pgAdmin. Recuerda la contraseña que le pongas al usuario `postgres`.

### 2. Crear la base de datos

Crea una base de datos vacía llamada `puqui`. Puedes hacerlo en pgAdmin (clic derecho en *Databases* → *Create* → *Database…*) o desde una terminal:

```bash
createdb -U postgres puqui
```

### 3. Configurar el backend

```bash
cd backend
cp .env.example .env      # en Windows: copy .env.example .env
```

Edita `backend/.env`: en `DATABASE_URL` pon la contraseña de tu usuario `postgres` y en `JWT_SECRET` cualquier texto largo.

```
DATABASE_URL=postgres://postgres:TU_CONTRASEÑA@localhost:5432/puqui
```

### 4. Instalar, crear el esquema y cargar los datos de demostración

Desde la carpeta raíz del proyecto:

```bash
npm run setup       # instala las dependencias del backend y del frontend
npm run db:schema   # crea tablas, vistas y tipos (se puede repetir sin perder datos)
npm run db:seed     # carga los datos de demostración (borra lo anterior)
npm test            # 11 pruebas del motor de promociones (Tabla 33)
```

### 5. Iniciar el sistema

**Modo desarrollo** (con recarga automática). Abre dos terminales:

```bash
npm run dev:api     # API en http://localhost:4000
npm run dev:web     # interfaz en http://localhost:5173  ← abre esta
```

**Modo producción** (un solo servidor):

```bash
npm run build       # compila el frontend
npm start           # la API sirve también la interfaz en http://localhost:4000
```

## Usuarios de demostración

Todos usan la contraseña **`puqui2026`**. En `localhost`, la pantalla de inicio de sesión también los muestra para elegirlos con un clic.

| Rol | Correo | Nombre | Módulo |
| --- | --- | --- | --- |
| Propietario | propietaria@puqui.pe | Rosa Mendoza | — |
| Propietario | propietario@puqui.pe | Jorge Mendoza | — |
| Administrador | admin@puqui.pe | Aldair Mendoza | — |
| Repartidor | repartidor@puqui.pe | Luis Pardo | — |
| Vendedor | ana@puqui.pe | Ana Torres | Puqui San Isidro |
| Vendedor | bruno@puqui.pe | Bruno Salas | Puqui Miraflores |
| Vendedor | carla@puqui.pe | Carla Ruiz | Puqui Surco |
| Vendedor | diego@puqui.pe | Diego León | Puqui La Molina |
| Vendedor | erika@puqui.pe | Erika Vega | Puqui San Borja |

El script de datos (`npm run db:seed`) crea:
- 5 módulos, 9 usuarios, 2 productos con 5 sabores cada uno y 4 promociones (entre ellas el 3x2).
- 30 días de historial: unas 1,900 ventas, entregas, devoluciones, cierres de caja con algunos descuadres y asistencia.
- El caso de Nutella del Capítulo 1 en San Isidro: 2 unidades del Día 3, 3 del Día 2 y 1 del Día 1.
- Para el día de hoy: La Molina sin turno abierto y lotes por devolver en San Isidro y Surco, de modo que el Dashboard muestre alertas.

Los precios, sabores y nombres son de demostración y no corresponden a cifras reales de la empresa.

**Para probar rápido:**
1. Entra como `diego@puqui.pe` (La Molina, sin turno abierto). Intenta vender: el sistema lo impide.
2. Abre la caja y vende 3 Flat Cookie: se aplica el 3x2 y el stock sale del lote más antiguo.
3. Entrega el turno y cierra la caja.
4. Entra como `admin@puqui.pe` y revisa el Dashboard.

## Notas

- **Asistencia:** el navegador pide permiso de ubicación. Funciona en `localhost` y en sitios con HTTPS. La ubicación solo se toma al marcar, con el consentimiento del trabajador (Ley N.° 29733).
- **PWA:** al publicarlo con HTTPS, se instala desde el navegador del celular («Agregar a la pantalla de inicio»). El service worker guarda solo la interfaz, nunca los datos de la API, así que el sistema necesita conexión a internet.
- **Despliegue:** basta un hosting con Node.js y PostgreSQL. Define `PORT`, `DATABASE_URL` y `JWT_SECRET`, ejecuta `npm run setup && npm run db:schema && npm run build` y luego `npm start`.
