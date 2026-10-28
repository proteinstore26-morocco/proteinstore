# -*- coding: utf-8 -*-
"""Test du site via l'URL publique du tunnel."""
import json
import sys
import urllib.request

BASE = "https://silent-wine-saver-dedicated.trycloudflare.com"

h = json.load(urllib.request.urlopen(BASE + "/api/health"))
print("health via tunnel:", h)

html = urllib.request.urlopen(BASE + "/").read().decode()
print("homepage via tunnel:", len(html), "bytes — title present:", "ProteinStore" in html)

prods = json.load(urllib.request.urlopen(BASE + "/api/products"))
print("products via tunnel:", len(prods["products"]))

admin = urllib.request.urlopen(BASE + "/admin").read().decode()
print("admin page via tunnel:", "Espace administrateur" in admin)

# commande complète via l'URL publique
body = json.dumps({
    "customer": {"name": "Client Public", "phone": "0698765432", "city": "Rabat",
                 "address": "Avenue Hassan II, Imm 8, Apt 3", "note": ""},
    "items": [{"slug": "applied-creatine-500", "qty": 1, "flavor": ""}],
}).encode()
req = urllib.request.Request(BASE + "/api/orders", data=body, method="POST",
                             headers={"Content-Type": "application/json"})
resp = json.load(urllib.request.urlopen(req))
print("order via tunnel:", resp["order"]["number"], "-", resp["order"]["total_mad"], "MAD")

track = json.load(urllib.request.urlopen(BASE + "/api/orders/" + resp["order"]["number"]))
print("tracking via tunnel:", track["order"]["status_label"])
print("PUBLIC URL FULLY WORKING")
