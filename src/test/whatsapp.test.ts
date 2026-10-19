import { describe, it, expect } from "vitest";
import {
  buildOrderMessage,
  buildTrackingMessage,
  whatsappUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp";
import { mad } from "@/lib/pricing";

const draft = {
  name: "Yassine  El Amrani ",
  phone: "0612345678",
  email: "",
  city: "Kénitra",
  address: "12 rue  Mohamed V",
  notes: "3e étage",
  items: [
    { title: "ISO 100 1.37kg", qty: 2, unitPrice: 1029, flavor: "Chocolat" },
    { title: "Créatine 300g", qty: 1, unitPrice: 249 },
  ],
  subtotal: 2307,
  shipping: 0,
  total: 2307,
};

describe("WhatsApp order message", () => {
  it("lists every line with quantity, flavour and line total", () => {
    const message = buildOrderMessage(draft);
    expect(message).toContain(`• 2 × ISO 100 1.37kg (Chocolat) — ${mad(2058)}`);
    expect(message).toContain(`• 1 × Créatine 300g — ${mad(249)}`);
  });

  it("includes totals, free shipping and the delivery details", () => {
    const message = buildOrderMessage(draft);
    expect(message).toContain(`Sous-total : ${mad(2307)}`);
    expect(message).toContain("Livraison : Gratuite");
    expect(message).toContain(`Total : ${mad(2307)}`);
    expect(message).toContain("Téléphone : 0612345678");
    expect(message).toContain("Adresse : 12 rue Mohamed V");
  });

  it("omits an empty email and collapses whitespace in names", () => {
    const message = buildOrderMessage(draft);
    expect(message).not.toContain("E-mail :");
    expect(message).toContain("Nom : Yassine El Amrani");
  });

  it("targets the shop number and URL-encodes the text", () => {
    expect(whatsappUrl("Bonjour & merci")).toBe(
      `https://wa.me/${WHATSAPP_NUMBER}?text=Bonjour%20%26%20merci`,
    );
  });

  it("builds a tracking message with optional fields", () => {
    expect(buildTrackingMessage("PS123", "0612345678")).toContain("N° de commande : PS123");
    expect(buildTrackingMessage("", "")).toBe(
      "Bonjour PROTEIN STORE® 👋\nJe souhaite suivre ma commande.",
    );
  });
});
