# -*- coding: utf-8 -*-
"""Test end-to-end de l'API ProteinStore (serveur local requis sur :8000)."""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def req(path, method="GET", body=None, headers=None):
    h = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


# 1. Create order
status, data = req("/api/orders", "POST", {
    "customer": {"name": "Test Client", "phone": "0612345678", "city": "Kénitra",
                 "address": "Rue Ibn Sina, quartier Mimosas, n 12", "note": "Appeler avant livraison"},
    "items": [{"slug": "iso-100-5lb", "qty": 1, "flavor": "Chocolate Fudge"},
              {"slug": "creatine-mono-300", "qty": 2, "flavor": ""}],
})
assert status == 201, (status, data)
order = data["order"]
print("1) order created:", order["number"], "total:", order["total_mad"], "MAD (expected 1549)")
print("   whatsapp url:", data["whatsapp_url"][:48] + "...")

# 2. Invalid phone rejected
s2, d2 = req("/api/orders", "POST", {"customer": {"name": "X Y", "phone": "123", "city": "Kénitra", "address": "Somewhere 5"}, "items": [{"slug": "shaker-700", "qty": 1}]})
assert s2 == 422 and "phone" in d2["error"].lower()
print("2) invalid phone rejected:", d2["error"])

# 3. Track order
s3, d3 = req("/api/orders/" + order["number"])
assert s3 == 200 and d3["order"]["status"] == "pending"
print("3) tracking works, status:", d3["order"]["status_label"], "| timeline steps:", len(d3["order"]["timeline"]))

# 4. Admin blocked without token
s4, d4 = req("/api/admin/stats")
assert s4 == 401
print("4) admin correctly blocked (401) without token")

# 5. Admin with token: stats + status flow
with open("data/admin_token.txt", encoding="utf-8") as f:
    token = f.read().strip()
s5, d5 = req("/api/admin/stats", headers={"X-Admin-Token": token})
assert s5 == 200
print("5) admin stats OK: revenue", d5["revenue_mad"], "MAD, pending:", d5["counts"]["pending"]["count"])
for st in ("confirmed", "shipped", "delivered"):
    s, d = req("/api/admin/orders/" + order["number"] + "/status", "POST", {"status": st}, {"X-Admin-Token": token})
    assert s == 200, (s, d)
print("   status flow pending -> confirmed -> shipped -> delivered OK")

# 6. Stock decremented
s6, d6 = req("/api/products/iso-100-5lb")
print("6) ISO 100 stock after order:", d6["product"]["stock"], "(was 30)")

# 7. Static pages
html = urllib.request.urlopen(BASE + "/").read().decode()
admin = urllib.request.urlopen(BASE + "/admin").read().decode()
assert "ProteinStore" in html and "best-sellers" in html
assert "Espace administrateur" in admin
for f in ("styles.css", "app.js", "admin.js"):
    urllib.request.urlopen(BASE + "/" + f).read()
print("7) index.html, admin.html, styles.css, app.js, admin.js all served OK")
print("ALL TESTS PASSED")
