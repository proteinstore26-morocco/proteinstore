/* ProteinStore — boutique (vanilla JS, aucune dépendance) */
"use strict";

const FREE_SHIPPING = 500;
const $ = (sel) => document.querySelector(sel);

const state = {
  products: [],
  categories: [],
  activeCategory: "",
  query: "",
  cart: loadCart(),
};

/* ---------------- panier (localStorage) ---------------- */
function loadCart() {
  try { return JSON.parse(localStorage.getItem("ps_cart") || "[]"); }
  catch { return []; }
}
function saveCart() {
  localStorage.setItem("ps_cart", JSON.stringify(state.cart));
  renderCartBadge();
}
function cartTotal() {
  return state.cart.reduce((sum, line) => {
    const p = state.products.find((x) => x.slug === line.slug);
    return p ? sum + p.price_mad * line.qty : sum;
  }, 0);
}
function cartCount() {
  return state.cart.reduce((n, l) => n + l.qty, 0);
}
function addToCart(slug, flavor = "") {
  const p = state.products.find((x) => x.slug === slug);
  if (!p) return;
  const line = state.cart.find((l) => l.slug === slug && l.flavor === flavor);
  if (line) line.qty = Math.min(line.qty + 1, p.stock || 50);
  else state.cart.push({ slug, qty: 1, flavor });
  saveCart();
  toast(`${p.name} ajouté au panier 🛒`);
}

/* ---------------- rendu catalogue ---------------- */
async function loadProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  state.products = data.products;
  state.categories = [...new Set(state.products.map((p) => p.category))];
  renderCategories();
  renderGrid();
  renderCart();
}

function renderCategories() {
  const box = $("#categories");
  box.innerHTML = "";
  const mk = (label, value) => {
    const b = document.createElement("button");
    b.className = "chip" + (state.activeCategory === value ? " active" : "");
    b.textContent = label;
    b.onclick = () => { state.activeCategory = value; renderCategories(); renderGrid(); };
    box.appendChild(b);
  };
  mk("Tout", "");
  state.categories.forEach((c) => mk(c, c));
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.products.filter((p) =>
    (!state.activeCategory || p.category === state.activeCategory) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  );
}

function renderGrid() {
  const grid = $("#grid");
  grid.innerHTML = "";
  const items = filtered();
  if (!items.length) {
    grid.innerHTML = `<p class="empty-note">Aucun produit trouvé.</p>`;
    return;
  }
  for (const p of items) grid.appendChild(productCard(p));
}

function productCard(p) {
  const card = document.createElement("article");
  card.className = "product-card";
  const discount = p.old_price_mad
    ? Math.round((1 - p.price_mad / p.old_price_mad) * 100) : 0;
  card.innerHTML = `
    <div class="product-visual" style="background:${p.gradient}">
      ${discount ? `<span class="product-flag">-${discount}%</span>` : ""}
      <span>${p.emoji}</span>
    </div>
    <div class="product-body">
      <span class="product-brand">${p.brand} · ${p.category}</span>
      <h3 class="product-name">${p.name}</h3>
      <span class="product-meta">${p.weight || ""}${p.flavors.length ? " · " + p.flavors.length + " goûts" : ""}</span>
      <div class="price-row">
        <span class="price">${fmt(p.price_mad)}</span>
        ${p.old_price_mad ? `<span class="price-old">${fmt(p.old_price_mad)}</span>` : ""}
      </div>
      ${p.stock > 0
        ? `<button class="add-btn">Ajouter au panier</button>`
        : `<button class="add-btn" disabled style="opacity:.4">Rupture de stock</button>`}
    </div>`;
  card.querySelector(".add-btn").onclick = (e) => {
    e.stopPropagation();
    if (p.flavors.length) openProductModal(p);
    else addToCart(p.slug);
  };
  card.onclick = () => openProductModal(p);
  return card;
}

/* ---------------- modal produit ---------------- */
function openProductModal(p) {
  const box = $("#product-detail");
  const opts = p.flavors.map((f, i) => `<option value="${f}">${f}</option>`).join("");
  box.innerHTML = `
    <div class="detail-head">
      <div class="detail-visual" style="background:${p.gradient}">${p.emoji}</div>
      <div>
        <span class="product-brand">${p.brand} · ${p.category}</span>
        <h3>${p.name}</h3>
        <div class="price-row" style="margin:0">
          <span class="price">${fmt(p.price_mad)}</span>
          ${p.old_price_mad ? `<span class="price-old">${fmt(p.old_price_mad)}</span>` : ""}
        </div>
        <p class="product-meta" style="margin:.4rem 0 0">Pack : ${p.weight || "—"} · ${p.servings ? p.servings + " doses · " : ""}${p.stock > 0 ? "En stock" : "Rupture"}</p>
      </div>
    </div>
    <p class="detail-desc">${p.description}</p>
    ${p.flavors.length ? `
      <label style="display:block;font-weight:700;font-size:.88rem;margin-bottom:.4rem">Goût
        <select id="detail-flavor" style="width:100%;margin-top:.3rem;padding:.55rem;border-radius:9px;background:#16161a;color:#f4f4f5;border:1px solid #26262b">${opts}</select>
      </label>` : ""}
    <div style="display:flex;align-items:center;gap:.7rem;margin-top:.9rem">
      <div class="qty-controls">
        <button type="button" id="detail-minus">−</button><strong id="detail-qty">1</strong><button type="button" id="detail-plus">+</button>
      </div>
      <button class="btn btn-primary" style="flex:1" id="detail-add" ${p.stock ? "" : "disabled"}>Ajouter au panier — <span id="detail-line-total"></span></button>
    </div>`;
  let qty = 1;
  const flavorSel = box.querySelector("#detail-flavor");
  const lineTotal = () => {
    box.querySelector("#detail-line-total").textContent = fmt(p.price_mad * qty);
    box.querySelector("#detail-qty").textContent = qty;
  };
  lineTotal();
  box.querySelector("#detail-minus").onclick = () => { qty = Math.max(1, qty - 1); lineTotal(); };
  box.querySelector("#detail-plus").onclick = () => { qty = Math.min(p.stock || 50, qty + 1); lineTotal(); };
  flavorSel && (flavorSel.onchange = () => {});
  box.querySelector("#detail-add").onclick = () => {
    addToCart(p.slug, flavorSel ? flavorSel.value : "");
    closeModal("#product-modal");
    openCart();
  };
  openModal("#product-modal");
}

/* ---------------- panier UI ---------------- */
function renderCartBadge() {
  $("#cart-count").textContent = cartCount();
}
function renderCart() {
  renderCartBadge();
  const box = $("#cart-items");
  box.innerHTML = "";
  if (!state.cart.length) {
    box.innerHTML = `<p class="cart-empty">Votre panier est vide.<br>Ajoutez des produits pour commander 💪</p>`;
  }
  for (const line of state.cart) {
    const p = state.products.find((x) => x.slug === line.slug);
    if (!p) continue;
    const div = document.createElement("div");
    div.className = "cart-line";
    div.innerHTML = `
      <div class="cart-thumb" style="background:${p.gradient}">${p.emoji}</div>
      <div>
        <p class="cart-line-title">${p.name}</p>
        <p class="cart-line-meta">${fmt(p.price_mad)}${line.flavor ? " · " + line.flavor : ""}</p>
        <div class="qty-controls">
          <button data-a="minus">−</button><strong>${line.qty}</strong><button data-a="plus">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <strong>${fmt(p.price_mad * line.qty)}</strong><br>
        <button class="cart-remove" data-a="remove">Retirer</button>
      </div>`;
    div.querySelector('[data-a="minus"]').onclick = () => { line.qty--; if (line.qty <= 0) state.cart = state.cart.filter((l) => l !== line); saveCart(); renderCart(); };
    div.querySelector('[data-a="plus"]').onclick = () => { line.qty = Math.min(p.stock || 50, line.qty + 1); saveCart(); renderCart(); };
    div.querySelector('[data-a="remove"]').onclick = () => { state.cart = state.cart.filter((l) => l !== line); saveCart(); renderCart(); };
    box.appendChild(div);
  }
  const total = cartTotal();
  $("#cart-total").textContent = fmt(total);
  $("#shipping-hint").textContent = total >= FREE_SHIPPING
    ? "🚚 Livraison gratuite !"
    : `Plus que ${fmt(FREE_SHIPPING - total)} pour la livraison gratuite.`;
  $("#checkout-total").textContent = fmt(total);
}

/* ---------------- commande ---------------- */
async function submitOrder(e) {
  e.preventDefault();
  const f = e.target;
  const err = f.querySelector(".form-error");
  const payload = {
    customer: {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      city: f.city.value.trim(),
      address: f.address.value.trim(),
      note: f.note.value.trim(),
    },
    items: state.cart,
  };
  if (err) err.textContent = "";
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (err) err.textContent = data.error || "Erreur lors de la commande.";
      return;
    }
    state.cart = [];
    saveCart();
    renderCart();
    closeModal("#checkout-modal");
    closeModal("#cart-drawer");
    $("#cart-overlay").hidden = true;
    $("#success-number").textContent = data.order.number;
    $("#success-whatsapp").href = data.whatsapp_url;
    openModal("#success-modal");
  } catch {
    if (err) err.textContent = "Connexion impossible au serveur.";
  }
}

/* ---------------- suivi ---------------- */
async function trackOrder(e) {
  e.preventDefault();
  const number = $("#track-number").value.trim().toUpperCase();
  const box = $("#track-result");
  box.innerHTML = `<p class="muted">Recherche…</p>`;
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(number)}`);
    const data = await res.json();
    if (!res.ok) {
      box.innerHTML = `<p class="form-error">Commande introuvable. Vérifiez le numéro.</p>`;
      return;
    }
    const o = data.order;
    box.innerHTML = `
      <div class="track-status">
        <h3 style="margin:0">Commande ${o.number}</h3>
        <p class="muted" style="margin:.3rem 0 0">Passée le ${new Date(o.created_at).toLocaleString("fr-FR")} · Livraison à ${o.city} · Total ${fmt(o.total_mad)}</p>
        <p style="font-weight:800;color:var(--accent);margin:.6rem 0 0">Statut : ${o.status_label}</p>
        <ul class="timeline">
          ${o.timeline.map((t) => `
            <li class="${t.done ? "done" : ""}">
              <span class="dot">${t.done ? "✓" : ""}</span> ${t.label}
            </li>`).join("")}
        </ul>
        <h4 style="margin:1.2rem 0 .3rem">Articles</h4>
        <ul style="margin:.2rem 0 0;padding-left:1.2rem">
          ${o.items.map((i) => `<li>${i.qty}× ${i.name}${i.flavor ? ` (${i.flavor})` : ""} — ${fmt(i.price_mad * i.qty)}</li>`).join("")}
        </ul>
      </div>`;
  } catch {
    box.innerHTML = `<p class="form-error">Connexion impossible au serveur.</p>`;
  }
}

/* ---------------- vues (hash routing) ---------------- */
function route() {
  const hash = location.hash.replace(/^#\/?/, "").split("?")[0];
  const views = { "": "boutique", "suivi": "suivi", "contact": "contact" };
  const view = views[hash] ?? "boutique";
  for (const name of ["boutique", "suivi", "contact"]) {
    $(`#view-${name}`).hidden = name !== view;
  }
  document.querySelectorAll(".nav a[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === view);
  });
  if (view === "boutique" && hash === "") $("#catalogue").scrollIntoView = null;
  if (hash === "" ) window.scrollTo({ top: 0 });
}

/* ---------------- helpers ---------------- */
function fmt(n) {
  return `${Number(n).toLocaleString("fr-FR")} DH`;
}
function openModal(sel) { $(sel).hidden = false; }
function closeModal(sel) { $(sel).hidden = true; }
function openCart() {
  renderCart();
  $("#cart-drawer").hidden = false;
  $("#cart-overlay").hidden = false;
}
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#cart-btn").onclick = openCart;
  $("#cart-close").onclick = () => { $("#cart-drawer").hidden = true; $("#cart-overlay").hidden = true; };
  $("#cart-overlay").onclick = () => { $("#cart-drawer").hidden = true; $("#cart-overlay").hidden = true; };
  $("#product-close").onclick = () => closeModal("#product-modal");
  $("#checkout-close").onclick = () => closeModal("#checkout-modal");
  $("#checkout-modal").addEventListener("click", (e) => { if (e.target.id === "checkout-modal") closeModal("#checkout-modal"); });
  $("#product-modal").addEventListener("click", (e) => { if (e.target.id === "product-modal") closeModal("#product-modal"); });
  $("#success-modal").addEventListener("click", (e) => { if (e.target.id === "success-modal") closeModal("#success-modal"); });
  $("#success-close").onclick = () => closeModal("#success-modal");
  $("#checkout-btn").onclick = () => {
    if (!state.cart.length) { toast("Votre panier est vide 🛒"); return; }
    renderCart();
    closeModal("#cart-drawer");
    $("#cart-overlay").hidden = true;
    openModal("#checkout-modal");
  };
  $("#checkout-form").addEventListener("submit", submitOrder);
  const form = $("#checkout-form");
  if (!form.querySelector(".form-error")) {
    const div = document.createElement("p");
    div.className = "form-error";
    form.insertBefore(div, form.querySelector("button"));
  }
  $("#track-form").addEventListener("submit", trackOrder);
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
  window.addEventListener("hashchange", route);
  route();
  loadProducts();
});
