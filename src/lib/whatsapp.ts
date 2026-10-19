// WhatsApp ordering helpers. The store takes COD orders through WhatsApp:
// no card gateway, no server-side order write, no customer data stored locally.
import { mad } from "./pricing";

export const WHATSAPP_NUMBER = "212776566089";
export const WHATSAPP_DISPLAY = "+212 776 566 089";

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export type WhatsAppOrderLine = {
  title: string;
  qty: number;
  unitPrice: number;
  flavor?: string;
};

export type WhatsAppOrderDraft = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  notes?: string;
  items: WhatsAppOrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
};

const oneLine = (value: string, max = 300) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function buildOrderMessage(draft: WhatsAppOrderDraft): string {
  const lines = ["Bonjour PROTEIN STORE® 👋", "Je souhaite commander :", ""];

  for (const item of draft.items) {
    const flavor = item.flavor ? ` (${item.flavor})` : "";
    lines.push(`• ${item.qty} × ${item.title}${flavor} — ${mad(item.qty * item.unitPrice)}`);
  }

  lines.push(
    "",
    `Sous-total : ${mad(draft.subtotal)}`,
    `Livraison : ${draft.shipping ? mad(draft.shipping) : "Gratuite"}`,
    `Total : ${mad(draft.total)}`,
    "",
    `Nom : ${oneLine(draft.name, 100)}`,
    `Téléphone : ${oneLine(draft.phone, 30)}`,
  );
  if (draft.email?.trim()) lines.push(`E-mail : ${oneLine(draft.email, 255)}`);
  lines.push(`Ville : ${oneLine(draft.city, 80)}`, `Adresse : ${oneLine(draft.address, 300)}`);
  if (draft.notes?.trim())
    lines.push(`Remarques : ${draft.notes.replace(/\s+/g, " ").trim().slice(0, 500)}`);

  lines.push("", "Paiement à la livraison. Merci !");
  return lines.join("\n");
}

export function buildTrackingMessage(orderNumber: string, phone: string): string {
  const lines = ["Bonjour PROTEIN STORE® 👋", "Je souhaite suivre ma commande."];
  const number = oneLine(orderNumber, 30);
  const tel = oneLine(phone, 30);
  if (number) lines.push(`N° de commande : ${number}`);
  if (tel) lines.push(`Téléphone : ${tel}`);
  return lines.join("\n");
}
