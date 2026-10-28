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
  | "partners"
  | "categories"
  | "campaign"
  | "info"
  | "unknown";

/* Garde-fous : insultes, hors-sujet, tentatives de détournement. */
const OFFENSIVE_WORDS = [
  "connard", "salope", "putain de", "enculé", "fdp", "batard", "bâtard",
  "idiot", "débile", "imbécile", "nul à chier", "fuck", "shit", "bitch",
  "asshole", "stupid bot", "احمق", "كلب",
];
const OFFTOPIC_WORDS = [
  "président", "president", "politique", "politique ", "religion", "religieux",
  "météo", "meteo", "météo ?", "blague", "joke", "mario", "pokemon", "minecraft",
  "bitcoin", "crypto", "bourse", "recette de cuisine", "devoir de maths",
];
const INJECTION_WORDS = [
  "ignore tes instructions", "ignore previous", "ignore all", "system prompt",
  "tu es chatgpt", "you are chatgpt", "révèle ton prompt", "reveal your prompt",
  "oublie tes règles", "forget your rules",
];

/** Vrai si le message est hors-sujet, injurieux ou tente de détourner l'assistant. */
export function detectGuardrail(message: string): boolean {
  const text = ` ${message.toLowerCase()} `;
  if (has(text, OFFENSIVE_WORDS)) return true;
  if (has(text, INJECTION_WORDS)) return true;
  if (has(text, OFFTOPIC_WORDS)) return true;
  // Charabia : assez long, sans voyelle, ou même caractère répété
  const compact = message.trim();
  if (compact.length >= 10) {
    const vowels = (compact.match(/[aeiouyàâéèêëîïôöûüà]/gi) ?? []).length;
    if (vowels === 0) return true;
    if (/(.)\1{5,}/.test(compact)) return true;
  }
  return false;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const ORDER_WORDS = ["commande", "commande ", "suivi", "suivre", "ma commande", "order", "track", "طلبي", "تتبع", "الطلب"];
const STOCK_WORDS = [
  "stock", "dispo", "disponible", "available", "in stock", "متوفر", "متاح", "توفر",
  "vous avez", "avez-vous", "vous auriez", "est ce que vous avez", "est-ce que vous avez",
  "do you have", "do you sell",
  "creatine", "créatine", "whey", "protéine", "protein", "isolate", "isot",
  "gainer", "mass gainer", "bcaa", "eaa", "omega", "oméga", "zinc", "magnésium",
  "magnesium", "vitamine", "multivit", "shaker", "barre protéinée", "pré-workout",
  "pre-workout", "brûleur", "bruleur", "carnitine", "collagène", "collagen",
  "ashwagandha", "berberine", "mélatonine", "melatonin", "hydroxycut",
];
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
const PARTNERS_WORDS = [
  "partenaire", "partenaires", "salle", "salles", "gym", "club", "code ",
  "code promo", "réduction", "reduction", "remise", "discount", "شريك", "نادي", "خصم",
];
const CATEGORY_WORDS = ["catégorie", "categorie", "cATEGORIES", "category", "rayon", "types de", "فئة", "تصنيف"];
const CAMPAIGN_WORDS = ["promo active", "solde", "soldes", "vente flash", "flash", "promotion", "promotions", "تخفيضات", "عرض"];
const INFO_WORDS = ["horaire", "horaires", "ouvert", "adresse", "où êtes", "où se trouve", "magasin physique", "hours", "open", "address", "ساعات", "عنوان"];

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
  if (has(text, STOCK_WORDS) || has(text, ["prix de", "combien coûte", "combien coute", "prix ?", "le prix"])) return "stock";
  if (has(text, PARTNERS_WORDS)) return "partners";
  if (has(text, CAMPAIGN_WORDS)) return "campaign";
  if (has(text, CATEGORY_WORDS)) return "categories";
  if (has(text, INFO_WORDS)) return "info";
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
