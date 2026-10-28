/* ProteinStore — tableau de bord admin (vanilla JS) */
"use strict";

const $ = (s) => document.querySelector(s);
const token = () => localStorage.getItem("ps_admin_token") || "";
const STATUS_LABELS = {
  pending: "En attente", confirmed: "Confirmée", shipped: "Expédiée",
  delivered: "Livrée", cancelled: "Annulée",
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Admin-Token": token() },
  });
  if (res.status === 401) { showLogin(); throw new Error("unauthorized"); }
  return res.json();
}

function fmt(n) { return `${Number(n).toLocaleString("fr-FR")} DH`; }

/* ---------------- login ---------------- */
function showLogin() {
  $("#login-view").hidden = false;
  $("#dash-view").hidden = true;
  $("#logout").style.display = "none";
}
function showDash() {
  $("#login-view").hidden = true;
  $("#dash-view").hidden = false;
  $("#logout").style.display = "";
  refresh();
}

async function tryLogin() {
  const t = $("#token-input").value.trim();
  localStorage.setItem("ps_admin_token", t);
  try {
    const r = await fetch("/api/admin/stats", { headers: { "X-Admin-Token": t } });
    if (r.ok) { showDash(); return; }
  } catch {}
  localStorage.removeItem("ps_admin_token");
  $("#login-error").textContent = "Token invalide.";
}

/* ---------------- dashboard ---------------- */
async function refresh() {
  try {
    const [stats, orders] = await Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/orders" + ($("#status-filter").value ? `?status=${$("#status-filter").value}` : "")),
    ]);
    renderStats(stats);
    renderOrders(orders.orders);
  } catch {}
}

function renderStats(stats) {
  const cards = [
    { label: "En attente", v: stats.counts.pending.count },
    { label: "Confirmées", v: stats.counts.confirmed.count },
    { label: "Expédiées", v: stats.counts.shipped.count },
    { label: "Livrées", v: stats.counts.delivered.count },
    { label: "Chiffre d'affaires", v: fmt(stats.revenue_mad) },
  ];
  $("#stats").innerHTML = cards.map((c) =>
    `<div class="stat-card"><div class="label">${c.label}</div><div class="value">${c.v}</div></div>`
  ).join("");
}

function renderOrders(orders) {
  const body = $("#orders-body");
  $("#orders-empty").hidden = orders.length > 0;
  body.innerHTML = "";
  for (const o of orders) {
    const tr = document.createElement("tr");
    const cust = o.customer || {};
    const waPhone = String(cust.phone || "").replace(/^0/, "212");
    const waText = encodeURIComponent(
      `Bonjour ${cust.name || ""}, votre commande ${o.number} — statut : ${o.status_label}. — ProteinStore`
    );
    tr.innerHTML = `
      <td><strong>${o.number}</strong><br><span class="muted small">${new Date(o.created_at).toLocaleString("fr-FR")}</span></td>
      <td>${escapeHtml(cust.name || "")}<br>
          <span class="muted small">${escapeHtml(cust.phone || "")}<br>${escapeHtml(cust.city || "")} — ${escapeHtml(cust.address || "")}${cust.note ? `<br>Note : ${escapeHtml(cust.note)}` : ""}</span></td>
      <td>${o.items.map((i) => `${i.qty}× ${escapeHtml(i.name)}${i.flavor ? ` (${escapeHtml(i.flavor)})` : ""}`).join("<br>")}</td>
      <td><strong>${fmt(o.total_mad)}</strong></td>
      <td><span class="status-pill st-${o.status}">${o.status_label}</span></td>
      <td>
        <select class="status-select" data-number="${o.number}">
          ${Object.entries(STATUS_LABELS).map(([k, v]) =>
            `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </td>
      <td><a class="btn btn-ghost" style="padding:.3rem .7rem;font-size:.8rem" target="_blank" rel="noopener"
             href="https://wa.me/${escapeHtml(waPhone)}?text=${waText}">💬</a></td>`;
    tr.querySelector("select").onchange = async (e) => {
      const r = await api(`/api/admin/orders/${o.number}/status`, {
        method: "POST",
        body: JSON.stringify({ status: e.target.value }),
      });
      if (r.error) { alert(r.error); refresh(); return; }
      refresh();
    };
    body.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#login-btn").onclick = tryLogin;
  $("#token-input").addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
  $("#logout").onclick = () => { localStorage.removeItem("ps_admin_token"); showLogin(); };
  $("#refresh").onclick = refresh;
  $("#status-filter").onchange = refresh;
  if (token()) {
    // vérifie le token au chargement
    fetch("/api/admin/stats", { headers: { "X-Admin-Token": token() } })
      .then((r) => (r.ok ? showDash() : showLogin()))
      .catch(showLogin);
  } else {
    showLogin();
  }
});
