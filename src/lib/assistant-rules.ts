// Assistant ProteinStore — NLU déterministe (pur, testable).
// Détecte l'intention et extrait les données d'un message client.

export type Intent =
  | "order"
  | "stock"
  | "delivery"
  | "payment"
  | "medical"
  | "handoff"
  | "greeting"
  | "unknown";

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const ORDER_WORDS = ["commande", "commande ", "suivi", "suivre", "ma commande", "order", "track", "طلبي", "تتبع", "الطلب"];
const STOCK_WORDS = ["stock", "dispo", "disponible", "available", "in stock", "متوفر", "متاح", "توفر"];
const DELIVERY_WORDS = ["livraison", "livrer", "délai", "delai", "expédition", "expedie", "shipping", "delivery", "توصيل"];
const PAYMENT_WORDS = ["paiement", "payement", "payer", "cash", "cod", "espèce", "espèces", "دفع"];
const MEDICAL_WORDS = [
  "dosage", "posologie", "médical", "medical", "docteur", "médecin", "doctor",
  "malade", "douleur", "santé", "health", "steroid", "stéroïde", "doping",
  "maladie", "traitement", "صحة", "طبيب", "دواء", "علاج",
];
const HANDOFF_WORDS = [
  "humain", "humaine", "conseiller", "agent", "whatsapp", "parler à", "parler au",
  "changer", "modifier", "retour", "rembours", "plainte", "problème", "probleme",
  "custom", "spécifique", "spéciale", "مشكل", "بشري",
];
const GREETING_WORDS = ["bonjour", "bonsoir", "salut", "coucou", "hello", "hi ", "slt", "salam", "سلام", "مرحبا"];

export function extractOrderNumber(message: string): string | null {
  const ps = message.match(/PS-\d{4}-\d{4,6}/i);
  if (ps) return ps[0].toUpperCase();
  const hash = message.match(/#\s?(\d{4,6})/);
  if (hash) return hash[1] ?? null;
  const bare = message.match(/\b(20\d{2})-(\d{4,6})\b/);
  if (bare) return `PS-${bare[1] ?? ""}-${bare[2] ?? ""}`;
  return null;
}

export function extractPhone(message: string): string | null {
  const m = message.match(/(?:\+212|0)[\s.-]?[5-7](?:[\s.-]?\d){8}/);
  return m ? (m[0] ?? null) : null;
}

export function detectIntent(message: string): Intent {
  const text = ` ${message.toLowerCase()} `;
  if (has(text, MEDICAL_WORDS)) return "medical";
  if (extractOrderNumber(message)) return "order";
  if (has(text, GREETING_WORDS) && message.trim().length < 25) return "greeting";
  if (has(text, ORDER_WORDS)) return "order";
  if (has(text, STOCK_WORDS)) return "stock";
  if (has(text, DELIVERY_WORDS)) return "delivery";
  if (has(text, PAYMENT_WORDS)) return "payment";
  if (has(text, HANDOFF_WORDS)) return "handoff";
  return "unknown";
}

/** Mots-clés produit (>= 4 caractères, hors mots vides) pour la recherche stock. */
export function productTokens(message: string): string[] {
  const stop = new Set([
    "vous", "avec", "pour", "dans", "chez", "avoir", "avez", "encore", "encore ",
    "the", "and", "have", "you", "your", "does", "c'est", "est-ce", "combien",
    " discrete", "discrète", "produit", "produits", "protein", "protéine", "protéines",
  ]);
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
}
