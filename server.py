#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ProteinStore — boutique de compléments alimentaires (Kénitra, Maroc).
Serveur de test autonome : Python stdlib uniquement (aucune dépendance),
SQLite (mode WAL) pour les commandes, API JSON + fichiers statiques.

Lancement :  python server.py            (port 8000 par défaut)
Variables :  PORT=8000  HOST=127.0.0.1  ADMIN_TOKEN=xxx
"""
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
PUBLIC = BASE / "public"
DB_PATH = DATA / "store.db"

STORE_NAME = "ProteinStore"
STORE_CITY = "Kénitra, Maroc"
WHATSAPP_NUMBER = "212776566089"
ORDER_PREFIX = "PS"

STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
MAX_BODY = 100_000  # 100 Ko

# ---------------------------------------------------------------------------
# Base de données
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    price_mad REAL NOT NULL CHECK (price_mad >= 0),
    old_price_mad REAL,
    weight TEXT,
    servings INTEGER,
    description TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '💪',
    gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg,#1f2937,#111827)',
    flavors TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 50 CHECK (stock >= 0),
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
    total_mad REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    price_mad REAL NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    flavor TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
"""

SEED_PRODUCTS = [
    ("iso-100-5lb", "Dymatize ISO 100 Whey Isolate", "Dymatize", "Whey & Protéines",
     1029, 1149, "2,27 kg (5 lbs)", 76, "Isolat de whey ultra-filtré : 25 g de protéines, moins de 1 g de sucre par dose. Le best-seller absolu pour la prise de muscle sec.",
     "🥛", "linear-gradient(135deg,#0ea5e9,#0c4a6e)", "Chocolate Fudge,Gourmet Vanilla,Strawberry,Cookies & Cream", 30),
    ("whey-gold-2kg", "Whey Gold Standard 100% Whey", "Optimum Nutrition", "Whey & Protéines",
     620, 690, "2,27 kg", 74, "La référence mondiale des protéines : 24 g de protéines par dose, filtration croisée, mélange facile et goût excellent.",
     "💪", "linear-gradient(135deg,#0f766e,#134e4a)", "Chocolate,Vanilla,Strawberry", 40),
    ("serious-mass-5kg", "Serious Mass 5,44 kg", "Optimum Nutrition", "Gainers",
     690, None, "5,44 kg", 32, "1250 kcal par dose avec vitamines et minéraux. Le gainer de référence pour prendre du volume rapidement.",
     "🏋️", "linear-gradient(135deg,#b45309,#7c2d12)", "Chocolate,Vanilla,Strawberry", 18),
    ("mass-tech-3kg", "Mass-Tech Elite 3 kg", "Muscletech", "Gainers",
     480, 530, "3 kg", 32, "Gainer haute calorie avec 80 g de protéines et créatine : conçu pour les prises de masse sérieuses.",
     "🍫", "linear-gradient(135deg,#92400e,#78350f)", "Chocolate,Vanilla", 30),
    ("applied-creatine-500", "Créatine Monohydrate 500 g", "Applied Nutrition", "Créatine",
     449, 699, "500 g", 167, "Créatine monohydrate micronisée ultra-pure (Creapure®). Force, puissance et volume musculaire. Meilleure vente 2026.",
     "⚡", "linear-gradient(135deg,#ca8a04,#a16207)", "", 50),
    ("creatine-mono-300", "Créatine Monohydrate Micronisée 300 g", "Muscletech", "Créatine",
     260, 300, "300 g", 100, "Créatine micronisée pure, sans additifs. Augmente force, puissance et volume musculaire. 100 prises.",
     "🔋", "linear-gradient(135deg,#a16207,#713f12)", "", 60),
    ("bcaa-2211-400", "BCAA 2:1:1 + Glutamine", "Scitec", "BCAA",
     310, 350, "400 g", 80, "7 g de BCAA au ratio 2:1:1 par dose avec glutamine ajoutée : récupération et anti-catabolisme.",
     "🧬", "linear-gradient(135deg,#059669,#065f46)", "Citron,Fruits rouges,Orange", 35),
    ("pre-workout-300", "Pre-Workout Explosion", "Muscletech", "Pré-Workout",
     340, 380, "300 g", 40, "Formule énergétique pré-entraînement : caféine, bêta-alanine, citrulline. Focus et pump maximum.",
     "🔥", "linear-gradient(135deg,#dc2626,#7f1d1d)", "Fruit Punch,Blue Raspberry", 45),
    ("c4-original", "C4 Original Pre-Workout", "Cellucor", "Pré-Workout",
     390, None, "390 g", 30, "Le pré-workout n°1 aux USA : énergie explosive, endurance et vasodilatation.",
     "🚀", "linear-gradient(135deg,#7c3aed,#4c1d95)", "Watermelon,Fruit Punch", 28),
    ("hydroxycut-elite", "Hydroxycut Hardcore Elite", "Muscletech", "Brûleurs de graisse",
     399, 499, "100 gélules", 50, "Brûleur de graisse haute intensité : caféine anhydre, extrait de coléoptère vert, yohimbine. Sèche sérieuse.",
     "🔥", "linear-gradient(135deg,#b91c1c,#450a0a)", "", 40),
    ("omega3-200", "Oméga-3 1000 mg", "Now Foods", "Vitamines & Santé",
     160, 190, "200 gélules", 100, "Huile de poisson purifiée riche en EPA/DHA : cœur, cerveau, articulations et récupération.",
     "🐟", "linear-gradient(135deg,#0891b2,#155e75)", "", 70),
    ("multivit-90", "Multivitamine Daily Formula", "Universal", "Vitamines & Santé",
     130, None, "90 tablettes", 90, "Complexe complet de 25 vitamines et minéraux essentiels pour sportifs, 1 comprimé par jour.",
     "🛡️", "linear-gradient(135deg,#4d7c0f,#3f6212)", "", 80),
    ("l-carnitine-3000", "L-Carnitine 3000 Liquid", "Now Foods", "Brûleurs de graisse",
     190, 220, "473 ml", 31, "Carnitine liquide : transport des graisses vers les mitochondries, allié de la sèche.",
     "🍋", "linear-gradient(135deg,#65a30d,#365314)", "Citron,Baies", 40),
    ("barres-proteine-12", "Barres Protéinées (boîte de 12)", "Scitec", "Barres & Snacks",
     260, 290, "12 × 60 g", 12, "Barre moelleuse à 45 % de protéines, sans couche de chocolat qui fond. Parfait en collation.",
     "🍫", "linear-gradient(135deg,#a16207,#713f12)", "Chocolat-Noisette,Vanille-Caramel", 50),
    ("shaker-700", "Shaker Pro 700 ml", "ProteinStore", "Accessoires",
     70, 90, "700 ml", 1, "Shaker robuste avec tamis anti-grumeaux, graduations et couvercle verrouillable. Sans BPA.",
     "🥤", "linear-gradient(135deg,#334155,#0f172a)", "Noir,Rouge,Bleu", 100),
    ("zma-90", "ZMA récupération nuit", "Optimum Nutrition", "Vitamines & Santé",
     180, None, "90 gélules", 30, "Zinc, magnésium et B6 : sommeil profond, récupération et soutien hormonal naturel.",
     "🌙", "linear-gradient(135deg,#312e81,#1e1b4b)", "", 45),
]


def db() -> sqlite3.Connection:
    DATA.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = db()
    conn.executescript(SCHEMA)
    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        conn.executemany(
            """INSERT INTO products
               (slug,name,brand,category,price_mad,old_price_mad,weight,servings,
                description,emoji,gradient,flavors,stock)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            SEED_PRODUCTS,
        )
    conn.commit()
    conn.close()


def get_admin_token() -> str:
    env = os.environ.get("ADMIN_TOKEN", "").strip()
    if env:
        return env
    f = DATA / "admin_token.txt"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    token = "psadmin-" + secrets.token_urlsafe(18)
    DATA.mkdir(exist_ok=True)
    f.write_text(token, encoding="utf-8")
    return token


ADMIN_TOKEN = get_admin_token()


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Logique métier
# ---------------------------------------------------------------------------

def next_order_number(conn: sqlite3.Connection) -> str:
    year = datetime.now().year
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM orders WHERE number LIKE ?", (f"{ORDER_PREFIX}-{year}-%",)
    ).fetchone()
    return f"{ORDER_PREFIX}-{year}-{row['n'] + 1:05d}"


PHONE_RE = re.compile(r"^(?:\+212|0)([5-7])\d{8}$")


def validate_order(payload: dict) -> tuple[dict | None, str]:
    if not isinstance(payload, dict):
        return None, "Corps JSON invalide."
    cust = payload.get("customer") or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return None, "Le panier est vide."

    name = str(cust.get("name", "")).strip()
    phone_raw = re.sub(r"[\s.\-]", "", str(cust.get("phone", "")))
    city = str(cust.get("city", "")).strip()
    address = str(cust.get("address", "")).strip()
    note = str(cust.get("note", "")).strip()[:500]

    if not (3 <= len(name) <= 80):
        return None, "Nom complet requis (3-80 caractères)."
    if not PHONE_RE.match(phone_raw):
        return None, "Numéro de téléphone marocain invalide (ex : 0612345678)."
    if not (2 <= len(city) <= 60):
        return None, "Ville requise."
    if not (5 <= len(address) <= 300):
        return None, "Adresse de livraison requise."

    clean_items = []
    for it in items:
        if not isinstance(it, dict):
            return None, "Article invalide."
        slug = str(it.get("slug", "")).strip()
        qty = it.get("qty", 1)
        flavor = str(it.get("flavor", "")).strip()[:50]
        if not slug or not isinstance(qty, int) or not (1 <= qty <= 50):
            return None, "Quantité invalide."
        clean_items.append({"slug": slug, "qty": qty, "flavor": flavor})

    conn = db()
    total = 0.0
    resolved = []
    for it in clean_items:
        row = conn.execute(
            "SELECT * FROM products WHERE slug=? AND active=1", (it["slug"],)
        ).fetchone()
        if row is None:
            conn.close()
            return None, f"Produit introuvable : {it['slug']}"
        if row["stock"] < it["qty"]:
            conn.close()
            return None, f"Stock insuffisant pour « {row['name']} »."
        total += row["price_mad"] * it["qty"]
        resolved.append((row, it))

    number = next_order_number(conn)
    ts = now_iso()
    try:
        cur = conn.execute(
            """INSERT INTO orders
               (number,customer_name,phone,city,address,note,status,total_mad,created_at,updated_at)
               VALUES (?,?,?,?,?,?,'pending',?,?,?)""",
            (number, name, phone_raw, city, address, note, round(total, 2), ts, ts),
        )
        order_id = cur.lastrowid
        for row, it in resolved:
            conn.execute(
                """INSERT INTO order_items (order_id,slug,name,price_mad,qty,flavor)
                   VALUES (?,?,?,?,?,?)""",
                (order_id, row["slug"], row["name"], row["price_mad"], it["qty"], it["flavor"]),
            )
            conn.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ?", (it["qty"], row["id"])
            )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        return None, "Erreur interne lors de l'enregistrement."
    conn.close()

    order = {
        "number": number,
        "total_mad": round(total, 2),
        "customer": {"name": name, "phone": phone_raw, "city": city, "address": address, "note": note},
        "items": [
            {
                "slug": r["slug"], "name": r["name"], "price_mad": r["price_mad"],
                "qty": it["qty"], "flavor": it["flavor"],
            }
            for r, it in resolved
        ],
        "status": "pending",
        "created_at": ts,
    }
    return order, ""


STATUS_LABELS = {
    "pending": "En attente",
    "confirmed": "Confirmée",
    "shipped": "Expédiée",
    "delivered": "Livrée",
    "cancelled": "Annulée",
}


def order_public(row: sqlite3.Row, include_customer: bool = False) -> dict:
    conn = db()
    items = [dict(r) for r in conn.execute(
        "SELECT slug,name,price_mad,qty,flavor FROM order_items WHERE order_id=?", (row["id"],)
    )]
    conn.close()
    flow = ["pending", "confirmed", "shipped", "delivered"]
    idx = flow.index(row["status"]) if row["status"] in flow else -1
    timeline = [
        {"status": s, "label": STATUS_LABELS[s], "done": idx >= i}
        for i, s in enumerate(flow)
    ]
    if row["status"] == "cancelled":
        timeline.append({"status": "cancelled", "label": STATUS_LABELS["cancelled"], "done": True})
    data = {
        "number": row["number"],
        "status": row["status"],
        "status_label": STATUS_LABELS[row["status"]],
        "total_mad": row["total_mad"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "city": row["city"],
        "items": items,
        "timeline": timeline,
    }
    if include_customer:
        data["customer"] = {
            "name": row["customer_name"], "phone": row["phone"],
            "city": row["city"], "address": row["address"], "note": row["note"],
        }
    return data


def product_dict(r: sqlite3.Row) -> dict:
    return {
        "slug": r["slug"], "name": r["name"], "brand": r["brand"], "category": r["category"],
        "price_mad": r["price_mad"], "old_price_mad": r["old_price_mad"],
        "weight": r["weight"], "servings": r["servings"], "description": r["description"],
        "emoji": r["emoji"], "gradient": r["gradient"],
        "flavors": [f for f in r["flavors"].split(",") if f], "stock": r["stock"],
    }


# ---------------------------------------------------------------------------
# Serveur HTTP
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ProteinStore/1.0"

    # -- helpers ------------------------------------------------------------
    def log_message(self, fmt, *args):  # log compact sur une ligne
        sys.stdout.write("%s %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, ctype: str):
        try:
            body = path.read_bytes()
        except OSError:
            self._send_json({"error": "not found"}, 404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return None
        if n <= 0 or n > MAX_BODY:
            return None
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def _is_admin(self) -> bool:
        tok = self.headers.get("X-Admin-Token", "")
        return hmac.compare_digest(tok, ADMIN_TOKEN)

    # -- routing ------------------------------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        route = unquote(parsed.path.rstrip("/") or "/")
        qs = parse_qs(parsed.query)

        if route == "/api/health":
            return self._send_json({"ok": True, "store": STORE_NAME, "time": now_iso()})
        if route == "/api/store":
            return self._send_json({
                "name": STORE_NAME, "city": STORE_CITY,
                "whatsapp": WHATSAPP_NUMBER, "currency": "MAD",
            })
        if route == "/api/products":
            conn = db()
            rows = conn.execute(
                "SELECT * FROM products WHERE active=1 ORDER BY category, name"
            ).fetchall()
            conn.close()
            prods = [product_dict(r) for r in rows]
            cat = (qs.get("category") or [""])[0]
            q = ((qs.get("q") or [""])[0]).strip().lower()
            if cat:
                prods = [p for p in prods if p["category"] == cat]
            if q:
                prods = [p for p in prods if q in p["name"].lower() or q in p["brand"].lower()]
            return self._send_json({"products": prods})
        if route.startswith("/api/products/"):
            slug = route[len("/api/products/"):]
            conn = db()
            row = conn.execute(
                "SELECT * FROM products WHERE slug=? AND active=1", (slug,)
            ).fetchone()
            conn.close()
            if row is None:
                return self._send_json({"error": "Produit introuvable"}, 404)
            return self._send_json({"product": product_dict(row)})
        if route.startswith("/api/orders/"):
            number = route[len("/api/orders/"):]
            conn = db()
            row = conn.execute("SELECT * FROM orders WHERE number=?", (number,)).fetchone()
            conn.close()
            if row is None:
                return self._send_json({"error": "Commande introuvable"}, 404)
            return self._send_json({"order": order_public(row)})

        # Admin
        if route == "/api/admin/orders":
            if not self._is_admin():
                return self._send_json({"error": "Token admin invalide"}, 401)
            status = (qs.get("status") or [""])[0]
            conn = db()
            if status in STATUSES:
                rows = conn.execute(
                    "SELECT * FROM orders WHERE status=? ORDER BY id DESC", (status,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 500").fetchall()
            conn.close()
            return self._send_json({"orders": [order_public(r, include_customer=True) for r in rows]})
        if route == "/api/admin/stats":
            if not self._is_admin():
                return self._send_json({"error": "Token admin invalide"}, 401)
            conn = db()
            stats = {}
            for s in STATUSES:
                stats[s] = conn.execute(
                    "SELECT COUNT(*) c, COALESCE(SUM(total_mad),0) t FROM orders WHERE status=?",
                    (s,),
                ).fetchone()
            revenue = conn.execute(
                "SELECT COALESCE(SUM(total_mad),0) t FROM orders WHERE status != 'cancelled'"
            ).fetchone()["t"]
            conn.close()
            return self._send_json({
                "counts": {s: {"count": stats[s]["c"], "total_mad": round(stats[s]["t"], 2)} for s in STATUSES},
                "revenue_mad": round(revenue, 2),
            })

        # Fichiers statiques
        return self.serve_static(route)

    def do_POST(self):
        parsed = urlparse(self.path)
        route = unquote(parsed.path.rstrip("/") or "/")

        if route == "/api/orders":
            payload = self._read_json()
            if payload is None:
                return self._send_json({"error": "Corps JSON invalide ou trop grand"}, 400)
            order, err = validate_order(payload)
            if err:
                return self._send_json({"error": err}, 422)
            wa = build_whatsapp_link(order)
            return self._send_json({"order": order, "whatsapp_url": wa}, 201)

        if route.startswith("/api/admin/orders/"):
            if not self._is_admin():
                return self._send_json({"error": "Token admin invalide"}, 401)
            m = re.match(r"^/api/admin/orders/([^/]+)/status$", route)
            if not m:
                return self._send_json({"error": "Route inconnue"}, 404)
            number = m.group(1)
            payload = self._read_json()
            status = (payload or {}).get("status", "")
            if status not in STATUSES:
                return self._send_json({"error": "Statut invalide"}, 422)
            conn = db()
            row = conn.execute("SELECT * FROM orders WHERE number=?", (number,)).fetchone()
            if row is None:
                conn.close()
                return self._send_json({"error": "Commande introuvable"}, 404)
            if row["status"] == "delivered":
                conn.close()
                return self._send_json({"error": "Commande déjà livrée"}, 409)
            conn.execute(
                "UPDATE orders SET status=?, updated_at=? WHERE id=?", (status, now_iso(), row["id"])
            )
            conn.commit()
            row = conn.execute("SELECT * FROM orders WHERE id=?", (row["id"],)).fetchone()
            conn.close()
            return self._send_json({"order": order_public(row, include_customer=True)})

        return self._send_json({"error": "Route inconnue"}, 404)

    def serve_static(self, route: str):
        mapping = {
            "/": (PUBLIC / "index.html", "text/html; charset=utf-8"),
            "/index.html": (PUBLIC / "index.html", "text/html; charset=utf-8"),
            "/admin": (PUBLIC / "admin.html", "text/html; charset=utf-8"),
            "/styles.css": (PUBLIC / "styles.css", "text/css; charset=utf-8"),
            "/app.js": (PUBLIC / "app.js", "application/javascript; charset=utf-8"),
            "/admin.js": (PUBLIC / "admin.js", "application/javascript; charset=utf-8"),
        }
        if route in mapping:
            path, ctype = mapping[route]
            if path.exists():
                return self._send_file(path, ctype)
        if route.startswith("/assets/"):
            f = (PUBLIC / route.lstrip("/")).resolve()
            if str(f).startswith(str(PUBLIC.resolve())) and f.exists() and f.is_file():
                ctype = {
                    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                    ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
                }.get(f.suffix.lower(), "application/octet-stream")
                return self._send_file(f, ctype)
        # SPA fallback
        idx = PUBLIC / "index.html"
        if idx.exists() and not route.startswith("/api/"):
            return self._send_file(idx, "text/html; charset=utf-8")
        return self._send_json({"error": "not found"}, 404)


def build_whatsapp_link(order: dict) -> str:
    lines = [f"Bonjour {STORE_NAME} ! Je confirme ma commande {order['number']} :", ""]
    for it in order["items"]:
        fl = f" ({it['flavor']})" if it["flavor"] else ""
        lines.append(f"• {it['qty']}× {it['name']}{fl} — {it['price_mad'] * it['qty']:.0f} DH")
    lines += [
        "",
        f"Total : {order['total_mad']:.0f} DH (paiement à la livraison)",
        f"Nom : {order['customer']['name']}",
        f"Téléphone : {order['customer']['phone']}",
        f"Ville : {order['customer']['city']}",
        f"Adresse : {order['customer']['address']}",
    ]
    if order["customer"]["note"]:
        lines.append(f"Note : {order['customer']['note']}")
    from urllib.parse import quote
    return f"https://wa.me/{WHATSAPP_NUMBER}?text={quote(chr(10).join(lines))}"


def main() -> None:
    init_db()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"[ProteinStore] Boutique       : http://{host}:{port}")
    print(f"[ProteinStore] Admin         : http://{host}:{port}/admin")
    print(f"[ProteinStore] Token admin   : {ADMIN_TOKEN}")
    print(f"[ProteinStore] Base SQLite   : {DB_PATH}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[ProteinStore] Arrêt du serveur.")
        httpd.server_close()


if __name__ == "__main__":
    main()
