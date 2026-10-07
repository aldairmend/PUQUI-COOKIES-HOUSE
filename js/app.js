(function () {
  "use strict";

  const CONFIG = window.PUQUI_CONFIG;
  const PRODUCTS = window.PUQUI_PRODUCTS;
  const CATEGORIES = window.PUQUI_CATEGORIES;
  const STORAGE_KEY = "puqui-cart-v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  const money = (n) => `${CONFIG.moneda} ${n.toFixed(2)}`;
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Dibujo de galletas ----------
  // Generador pseudoaleatorio con semilla para que cada galleta se dibuje siempre igual.
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function cookieEl(product, seedSuffix = "") {
    const el = document.createElement("div");
    el.className = "cookie";
    el.style.setProperty("--masa", product.masa);
    el.style.setProperty("--topping", product.topping);

    const rand = seeded(product.id + seedSuffix);
    const filled = ["red-velvet", "nutella", "pistacho"].includes(product.id);
    if (filled) {
      const f = document.createElement("span");
      f.className = "cookie__filling";
      el.appendChild(f);
    }
    const chips = filled ? 6 : 9;
    for (let i = 0; i < chips; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = (filled ? 0.28 : 0.05) + rand() * (filled ? 0.1 : 0.3);
      const size = 9 + rand() * 7;
      const chip = document.createElement("span");
      chip.className = "cookie__chip";
      chip.style.width = `${size}%`;
      chip.style.height = `${size * (0.7 + rand() * 0.4)}%`;
      chip.style.left = `${50 + Math.cos(angle) * dist * 100 - size / 2}%`;
      chip.style.top = `${50 + Math.sin(angle) * dist * 100 - size / 2}%`;
      chip.style.transform = `rotate(${Math.round(rand() * 180)}deg)`;
      el.appendChild(chip);
    }
    return el;
  }

  function productArt(product) {
    if (!product.caja) return cookieEl(product);
    const wrap = document.createElement("div");
    wrap.className = "box-art";
    const box = document.createElement("div");
    box.className = "box-art__box";
    const assortment = ["clasica", "doble-choco", "red-velvet", "lucuma", "oreo", "nutella"];
    assortment.forEach((id, i) => box.appendChild(cookieEl(byId[id], product.id + i)));
    wrap.appendChild(box);
    return wrap;
  }

  function paintDecorativeCookies() {
    $$("[data-cookie]").forEach((slot) => {
      const product = byId[slot.dataset.cookie];
      if (product) slot.appendChild(cookieEl(product, "deco"));
    });
  }

  // ---------- Textos configurables ----------
  function fillConfig() {
    const wa = `https://wa.me/${CONFIG.whatsapp}`;
    const values = {
      deliveryGratis: money(CONFIG.deliveryGratisDesde),
      costoDelivery: money(CONFIG.costoDelivery),
      direccion: CONFIG.direccion,
      horario: CONFIG.horario,
    };
    $$("[data-config]").forEach((el) => {
      const key = el.dataset.config;
      if (key in values) el.textContent = values[key];
      if (key === "whatsappLink") el.href = wa;
      if (key === "emailLink") {
        el.href = `mailto:${CONFIG.email}`;
        el.textContent = CONFIG.email;
      }
      if (key === "instagramLink") {
        el.href = `https://instagram.com/${CONFIG.instagram}`;
        el.textContent = `@${CONFIG.instagram}`;
      }
    });
    $("#year").textContent = new Date().getFullYear();
  }

  // ---------- Catálogo ----------
  const state = { category: "todas", query: "" };

  function renderFilters() {
    const wrap = $("#filters");
    wrap.innerHTML = CATEGORIES.map(
      (c) =>
        `<button class="filter" role="tab" data-cat="${c.id}" aria-selected="${c.id === state.category}">${escapeHtml(c.nombre)}</button>`
    ).join("");
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn) return;
      state.category = btn.dataset.cat;
      $$(".filter", wrap).forEach((b) => b.setAttribute("aria-selected", b === btn));
      renderProducts();
    });
  }

  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function renderProducts() {
    const grid = $("#products");
    const q = normalize(state.query.trim());
    const list = PRODUCTS.filter(
      (p) =>
        (state.category === "todas" || p.categoria === state.category) &&
        (!q || normalize(p.nombre + " " + p.descripcion).includes(q))
    );

    grid.innerHTML = "";
    list.forEach((p, i) => {
      const card = document.createElement("article");
      card.className = "product";
      card.style.animationDelay = `${i * 40}ms`;
      card.innerHTML = `
        ${p.etiqueta ? `<span class="product__tag">${escapeHtml(p.etiqueta)}</span>` : ""}
        <div class="product__art"></div>
        <h3>${escapeHtml(p.nombre)}</h3>
        <p>${escapeHtml(p.descripcion)}</p>
        <div class="product__foot">
          <span class="price">${money(p.precio)}</span>
          <button class="btn btn--primary add-btn" data-id="${p.id}">Agregar</button>
        </div>`;
      $(".product__art", card).appendChild(productArt(p));
      grid.appendChild(card);
    });
    $("#emptyState").hidden = list.length > 0;
  }

  function setupCatalog() {
    renderFilters();
    renderProducts();
    let t;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.query = e.target.value;
        renderProducts();
      }, 120);
    });
    $("#products").addEventListener("click", (e) => {
      const btn = e.target.closest(".add-btn");
      if (!btn) return;
      cart.add(btn.dataset.id);
      btn.classList.add("added");
      btn.textContent = "¡Agregada! ✓";
      setTimeout(() => {
        btn.classList.remove("added");
        btn.textContent = "Agregar";
      }, 1100);
    });
  }

  // ---------- Carrito ----------
  const cart = {
    items: load(),
    coupon: null,

    add(id, qty = 1) {
      if (!byId[id]) return;
      this.items[id] = (this.items[id] || 0) + qty;
      this.save();
      toast(`${byId[id].nombre} agregada al carrito 🍪`);
      const btn = $("#cartOpen");
      btn.classList.remove("bump");
      void btn.offsetWidth;
      btn.classList.add("bump");
    },
    set(id, qty) {
      if (qty <= 0) delete this.items[id];
      else this.items[id] = Math.min(qty, 99);
      this.save();
    },
    clear() {
      this.items = {};
      this.coupon = null;
      this.save();
    },
    entries() {
      return Object.entries(this.items)
        .filter(([id]) => byId[id])
        .map(([id, qty]) => ({ product: byId[id], qty }));
    },
    count() {
      return this.entries().reduce((n, e) => n + e.qty, 0);
    },
    subtotal() {
      return this.entries().reduce((n, e) => n + e.qty * e.product.precio, 0);
    },
    totals(entrega = "delivery") {
      const subtotal = this.subtotal();
      const pct = this.coupon ? CONFIG.cupones[this.coupon] : 0;
      const descuento = Math.round(subtotal * pct) / 100;
      const conDescuento = subtotal - descuento;
      const delivery =
        entrega === "delivery" && conDescuento < CONFIG.deliveryGratisDesde ? CONFIG.costoDelivery : 0;
      return { subtotal, pct, descuento, delivery, total: conDescuento + delivery };
    },
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch (_) {
        /* almacenamiento no disponible: el carrito vive solo en memoria */
      }
      renderCart();
    },
  };

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return data && typeof data === "object" ? data : {};
    } catch (_) {
      return {};
    }
  }

  function renderCart() {
    const count = cart.count();
    $("#cartCount").textContent = count;
    $("#cartOpen").setAttribute("aria-label", `Abrir carrito (${count} productos)`);

    const body = $("#cartItems");
    const foot = $("#cartFoot");
    const entries = cart.entries();

    if (!entries.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cookie-wrap"></div>
          <p><strong>Tu carrito está vacío</strong></p>
          <p>¡Agrega unas galletas para endulzar tu día!</p>
          <a href="#menu" class="btn btn--primary" data-close-cart>Ver el menú</a>
        </div>`;
      $(".cookie-wrap", body).appendChild(cookieEl(byId.clasica, "empty"));
      foot.hidden = true;
      return;
    }

    foot.hidden = false;
    body.innerHTML = "";
    entries.forEach(({ product, qty }) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item__art"></div>
        <div>
          <h4>${escapeHtml(product.nombre)}</h4>
          <small>${money(product.precio)} c/u</small>
        </div>
        <div class="cart-item__right">
          <div class="qty">
            <button data-act="dec" data-id="${product.id}" aria-label="Quitar una">−</button>
            <span>${qty}</span>
            <button data-act="inc" data-id="${product.id}" aria-label="Agregar una">+</button>
          </div>
          <strong>${money(product.precio * qty)}</strong>
          <button class="remove" data-act="del" data-id="${product.id}">Eliminar</button>
        </div>`;
      $(".cart-item__art", row).appendChild(productArt(product));
      body.appendChild(row);
    });

    const subtotal = cart.subtotal();
    $("#cartSubtotal").textContent = money(subtotal);

    const hint = $("#cartHint");
    const checkoutBtn = $("#checkoutBtn");
    if (subtotal < CONFIG.pedidoMinimo) {
      hint.innerHTML = `El pedido mínimo es <strong>${money(CONFIG.pedidoMinimo)}</strong>. Te faltan <strong>${money(
        CONFIG.pedidoMinimo - subtotal
      )}</strong>.`;
      checkoutBtn.disabled = true;
    } else if (subtotal < CONFIG.deliveryGratisDesde) {
      const pct = Math.min(100, (subtotal / CONFIG.deliveryGratisDesde) * 100);
      hint.innerHTML = `Agrega <strong>${money(
        CONFIG.deliveryGratisDesde - subtotal
      )}</strong> más y el delivery es gratis 🛵<div class="progress"><span style="width:${pct}%"></span></div>`;
      checkoutBtn.disabled = false;
    } else {
      hint.innerHTML = `🎉 ¡Tienes <strong>delivery gratis</strong>!`;
      checkoutBtn.disabled = false;
    }
  }

  function setupCart() {
    const drawer = $("#cart");
    const overlay = $("#overlay");

    const open = () => {
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      overlay.hidden = false;
      document.body.classList.add("no-scroll");
      $("#cartClose").focus();
    };
    const close = () => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    };
    cartUi.open = open;
    cartUi.close = close;

    $("#cartOpen").addEventListener("click", open);
    $("#cartClose").addEventListener("click", close);
    overlay.addEventListener("click", close);

    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-cart]")) return close();
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const qty = cart.items[id] || 0;
      if (btn.dataset.act === "inc") cart.set(id, qty + 1);
      if (btn.dataset.act === "dec") cart.set(id, qty - 1);
      if (btn.dataset.act === "del") cart.set(id, 0);
    });

    $("#cartClear").addEventListener("click", () => {
      if (confirm("¿Vaciar el carrito?")) cart.clear();
    });

    $("#checkoutBtn").addEventListener("click", () => {
      close();
      openCheckout();
    });

    renderCart();
  }
  const cartUi = {};

  // ---------- Checkout ----------
  const form = () => $("#checkoutForm");
  const entregaActual = () => (form().elements.entrega.value || "delivery");

  function todayISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function renderSummary() {
    const t = cart.totals(entregaActual());
    const items = cart
      .entries()
      .map(
        ({ product, qty }) =>
          `<li><span>${qty} × ${escapeHtml(product.nombre)}</span><span>${money(qty * product.precio)}</span></li>`
      )
      .join("");
    $("#summary").innerHTML = `
      <ul>${items}</ul>
      <div class="totals">
        <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        ${t.descuento ? `<div class="discount"><span>Descuento (${escapeHtml(cart.coupon)} −${t.pct}%)</span><span>− ${money(t.descuento)}</span></div>` : ""}
        <div><span>Delivery</span><span>${t.delivery ? money(t.delivery) : "Gratis"}</span></div>
        <div class="total"><span>Total</span><span>${money(t.total)}</span></div>
      </div>`;
  }

  function toggleDireccion() {
    const isDelivery = entregaActual() === "delivery";
    const field = $("#direccionField");
    field.hidden = !isDelivery;
    form().elements.direccion.required = isDelivery;
  }

  function openCheckout() {
    if (!cart.count()) return;
    const modal = $("#checkout");
    const f = form();
    f.elements.fecha.min = todayISO();
    if (!f.elements.fecha.value) f.elements.fecha.value = todayISO(1);
    $("#checkoutError").hidden = true;
    toggleDireccion();
    renderSummary();
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    f.elements.nombre.focus();
  }

  function closeCheckout() {
    $("#checkout").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function applyCoupon() {
    const input = $("#couponInput");
    const msg = $("#couponMsg");
    const code = input.value.trim().toUpperCase();
    if (!code) {
      cart.coupon = null;
      msg.textContent = "";
      msg.className = "coupon__msg";
    } else if (CONFIG.cupones[code]) {
      cart.coupon = code;
      msg.textContent = `¡Cupón aplicado! −${CONFIG.cupones[code]}%`;
      msg.className = "coupon__msg ok";
    } else {
      cart.coupon = null;
      msg.textContent = "Cupón no válido";
      msg.className = "coupon__msg err";
    }
    renderSummary();
  }

  function validate(f) {
    $$(".invalid", f).forEach((el) => el.classList.remove("invalid"));
    const errors = [];
    const req = (name, label) => {
      const el = f.elements[name];
      if (!el.value.trim()) {
        el.classList.add("invalid");
        errors.push(label);
      }
    };
    req("nombre", "nombre");
    req("telefono", "teléfono");
    if (entregaActual() === "delivery") req("direccion", "dirección");
    req("fecha", "fecha");

    const tel = f.elements.telefono;
    if (tel.value.trim() && !/^[0-9 +()-]{6,}$/.test(tel.value.trim())) {
      tel.classList.add("invalid");
      errors.push("un teléfono válido");
    }
    const fecha = f.elements.fecha.value;
    if (fecha && fecha < todayISO()) {
      f.elements.fecha.classList.add("invalid");
      errors.push("una fecha desde hoy");
    }
    return errors;
  }

  function formatFecha(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  }

  function buildOrderMessage(data) {
    const t = cart.totals(data.entrega);
    const lines = [
      `¡Hola ${CONFIG.nombre}! 🍪 Quiero hacer un pedido:`,
      "",
      ...cart.entries().map(({ product, qty }) => `• ${qty} × ${product.nombre} — ${money(qty * product.precio)}`),
      "",
      `Subtotal: ${money(t.subtotal)}`,
    ];
    if (t.descuento) lines.push(`Descuento (${cart.coupon}): −${money(t.descuento)}`);
    lines.push(`Delivery: ${t.delivery ? money(t.delivery) : "Gratis"}`);
    lines.push(`*Total: ${money(t.total)}*`, "");
    lines.push(`👤 Nombre: ${data.nombre}`);
    lines.push(`📞 Teléfono: ${data.telefono}`);
    lines.push(
      data.entrega === "delivery" ? `🛵 Delivery a: ${data.direccion}` : "🏠 Recojo en tienda"
    );
    lines.push(`📅 Fecha: ${formatFecha(data.fecha)} · ${data.horario}`);
    lines.push(`💳 Pago: ${data.pago}`);
    if (data.notas) lines.push(`📝 Notas: ${data.notas}`);
    return lines.join("\n");
  }

  function openWhatsApp(text) {
    const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
    // Sin "noopener" en las opciones: con él, window.open siempre devuelve null.
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url;
  }

  function setupCheckout() {
    const f = form();
    $("#checkoutClose").addEventListener("click", closeCheckout);
    $("#checkout").addEventListener("click", (e) => {
      if (e.target.id === "checkout") closeCheckout();
    });
    $$('input[name="entrega"]', f).forEach((r) =>
      r.addEventListener("change", () => {
        toggleDireccion();
        renderSummary();
      })
    );
    $("#couponApply").addEventListener("click", applyCoupon);
    $("#couponInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCoupon();
      }
    });

    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const errBox = $("#checkoutError");
      const errors = validate(f);
      if (errors.length) {
        errBox.textContent = `Por favor completa: ${errors.join(", ")}.`;
        errBox.hidden = false;
        $(".invalid", f)?.focus();
        return;
      }
      errBox.hidden = true;
      const data = Object.fromEntries(
        ["nombre", "telefono", "direccion", "fecha", "horario", "pago", "notas", "entrega"].map((k) => [
          k,
          (f.elements[k].value || "").trim(),
        ])
      );
      openWhatsApp(buildOrderMessage(data));
      closeCheckout();
      cart.clear();
      f.reset();
      $("#couponMsg").textContent = "";
      toast("¡Gracias! Te confirmaremos tu pedido por WhatsApp 💛");
    });
  }

  // ---------- Contacto ----------
  function setupContact() {
    const f = $("#contactForm");
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = f.elements.nombre.value.trim();
      const mensaje = f.elements.mensaje.value.trim();
      const err = $("#contactError");
      f.elements.nombre.classList.toggle("invalid", !nombre);
      f.elements.mensaje.classList.toggle("invalid", !mensaje);
      if (!nombre || !mensaje) {
        err.textContent = "Escribe tu nombre y tu mensaje.";
        err.hidden = false;
        return;
      }
      err.hidden = true;
      openWhatsApp(`¡Hola ${CONFIG.nombre}! Soy ${nombre}.\n\n${mensaje}`);
      f.reset();
    });
  }

  // ---------- Navegación móvil ----------
  function setupNav() {
    const nav = $("#nav");
    const toggle = $("#menuToggle");
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    nav.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // Quita el borde de error en cuanto el usuario corrige el campo.
  document.addEventListener("input", (e) => e.target.classList?.remove("invalid"));

  // ---------- Teclado ----------
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#checkout").hidden) closeCheckout();
    else if ($("#cart").classList.contains("open")) cartUi.close();
  });

  // Sincroniza el carrito entre pestañas.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cart.items = load();
      renderCart();
    }
  });

  // ---------- Inicio ----------
  fillConfig();
  paintDecorativeCookies();
  setupCatalog();
  setupCart();
  setupCheckout();
  setupContact();
  setupNav();
})();
