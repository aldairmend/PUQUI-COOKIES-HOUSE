# 🍪 Puqui Cookies House

Sitio web de **Puqui Cookies House**, tienda de galletas artesanales. Los clientes ven el menú, arman su carrito y envían el pedido completo por **WhatsApp**.

## Funcionalidades

- **Catálogo** con 12 productos (clásicas, especiales, saludables y cajas), filtros por categoría y buscador.
- **Carrito** lateral con cantidades, persistencia en el navegador (`localStorage`) y sincronización entre pestañas.
- **Pedido mínimo** y barra de progreso hacia el **delivery gratis**.
- **Checkout** con datos del cliente, delivery o recojo, fecha y horario, forma de pago (Yape, Plin, transferencia o efectivo), notas y **cupones de descuento**.
- El pedido se envía como mensaje ya redactado a **WhatsApp** (`wa.me`).
- Secciones de nosotros, cómo pedir, preguntas frecuentes y contacto (también por WhatsApp).
- Diseño responsive, accesible (teclado, lectores de pantalla, `prefers-reduced-motion`) y sin dependencias: las galletas se dibujan con CSS.

## Estructura

```
index.html          Página principal
css/styles.css      Estilos
js/config.js        Datos de la tienda: WhatsApp, delivery, cupones, moneda…
js/products.js      Catálogo de productos y categorías
js/app.js           Lógica: catálogo, carrito, checkout y WhatsApp
assets/             Logo y favicon
```

## Personalizar

1. **WhatsApp y datos de contacto**: edita `js/config.js` (el número va en formato internacional sin `+`, por ejemplo `51987654321`).
2. **Productos y precios**: edita `js/products.js`. Cada producto tiene `masa` y `topping` (colores con los que se dibuja la galleta). Usa `caja: true` para mostrarlo como caja de regalo.
3. **Delivery, pedido mínimo y cupones**: en `js/config.js` (`costoDelivery`, `deliveryGratisDesde`, `pedidoMinimo`, `cupones`).

## Ver el sitio localmente

No necesita instalación. Abre `index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Publicar en GitHub Pages

1. En GitHub ve a **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, selecciona la rama y la carpeta `/ (root)`.
3. Guarda; en unos minutos el sitio estará en `https://<usuario>.github.io/PUQUI-COOKIES-HOUSE/`.
