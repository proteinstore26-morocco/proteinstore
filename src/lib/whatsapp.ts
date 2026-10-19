// WhatsApp message builders shared by the storefront and the admin dashboard.
import { mad } from "./pricing";
import { waNumber } from "./phone";
import { STATUS_LABELS, type OrderStatus } from "./order-types";

export const WHATSAPP_NUMBER = "212776566089";
export const WHATSAPP_DISPLAY = "+212 776 566 089";

/** Link to the shop's own number. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Link to a customer's number (admin actions). */
export function waUrlTo(phone: string, message: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(message)}`;
}

export type WhatsAppOrderLine = {
  title: string;
  qty: number;
  unitPrice: number;
  flavor?: string;
};

export type WhatsAppOrderDraft = {
  orderNumber?: string;
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
  if (draft.orderNumber) lines.push("", `N° de commande : ${draft.orderNumber}`);

  lines.push("", "Paiement à la livraison. Merci !");
  return lines.join("\n");
}

export function buildTrackingMessage(orderNumber: string, phone: string): string {
  const lines = ["Bonjour PROTEIN STORE® 👋", "Je souhaite suivre ma commande."];
  const number = oneLine(orderNumber, 40);
  const tel = oneLine(phone, 30);
  if (number) lines.push(`N° de commande : ${number}`);
  if (tel) lines.push(`Téléphone : ${tel}`);
  return lines.join("\n");
}

export type OrderMessageTarget = {
  orderNumber: string;
  customerName: string;
  total: number;
};

export function buildStatusMessage(order: OrderMessageTarget, status: OrderStatus): string {
  const name = oneLine(order.customerName, 60).split(" ")[0] || order.customerName;
  const intro = `Bonjour ${name},\n`;
  const footer = "\n\nL'équipe PROTEIN STORE® — Kénitra";

  switch (status) {
    case "pending":
      return `${intro}nous avons bien reçu votre commande ${order.orderNumber} (${mad(order.total)}). Nous vous appelons pour confirmer la livraison.\nPaiement à la livraison.${footer}`;
    case "confirmed":
      return `${intro}votre commande ${order.orderNumber} (${mad(order.total)}) est confirmée ✅. Nous préparons vos produits et revenons vers vous pour la livraison.${footer}`;
    case "shipped":
      return `${intro}votre commande ${order.orderNumber} est en route 🚚. Le livreur vous contactera avant de passer. Merci de préparer ${mad(order.total)} en espèces.${footer}`;
    case "delivered":
      return `${intro}votre commande ${order.orderNumber} a bien été livrée. Merci pour votre confiance 🙌. À bientôt chez PROTEIN STORE®.${footer}`;
    case "cancelled":
      return `${intro}votre commande ${order.orderNumber} a été annulée. Si c'est une erreur, répondez à ce message et nous la relançons.${footer}`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function buildInvoiceMessage(input: {
  customerName: string;
  invoiceNumber: string;
  orderNumber: string;
  total: number;
}): string {
  const name = oneLine(input.customerName, 60).split(" ")[0] || input.customerName;
  return `Bonjour ${name},\n\nvotre facture ${input.invoiceNumber} pour la commande ${input.orderNumber} (${mad(input.total)}) est prête.\nPaiement à la livraison.\n\nL'équipe PROTEIN STORE® — Kénitra`;
}

export function buildPaymentMessage(input: {
  customerName: string;
  orderNumber: string;
  total: number;
}): string {
  const name = oneLine(input.customerName, 60).split(" ")[0] || input.customerName;
  return `Bonjour ${name},\n\nnous confirmons la réception du paiement de ${mad(input.total)} pour la commande ${input.orderNumber}. Merci pour votre confiance 🙌\n\nL'équipe PROTEIN STORE® — Kénitra`;
}

/** Human label for a status, reused in messages and UI. */
export const statusLabel = (status: OrderStatus) => STATUS_LABELS[status];
