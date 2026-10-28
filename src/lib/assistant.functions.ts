// Assistant IA ProteinStore — réponses déterministes branchées sur les vraies
// données (suivi de commande, stock, règles livraison) + transfert WhatsApp.
// Personas : "saad" (coach direct) / "jihane" (copine fitness énergique).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  detectIntent,
  extractOrderNumber,
  extractPhone,
  productTokens,
  type Intent,
} from "./assistant-rules";

type Lang = "fr" | "en" | "ar";
type Persona = "saad" | "jihane";

const schema = z.object({
  message: z.string().trim().min(1).max(1000),
  persona: z.enum(["saad", "jihane"]).default("saad"),
  lang: z.enum(["fr", "en", "ar"]).default("fr"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(600) }))
    .max(12)
    .optional(),
});

type Reply = {
  messages: string[];
  products?: { title: string; slug: string; price: number; stock: number }[];
  whatsappUrl?: string | null;
  suggestions?: string[];
};

/* ---------- templates (fr / en / ar) ---------- */
function say(lang: Lang, fr: string, en: string, ar: string): string {
  return lang === "fr" ? fr : lang === "en" ? en : ar;
}

function tone(text: string, persona: Persona, lang: Lang): string {
  if (persona === "jihane") {
    return lang === "ar" ? `${text} 😊` : `${text} 😊`;
  }
  return lang === "ar" ? text : `${text} 💪`;
}

const STATUS_FR: Record<string, string> = {
  pending: "en attente de confirmation",
  confirmed: "confirmée — en préparation",
  shipped: "expédiée, en cours de livraison 🚚",
  delivered: "livrée. Bon courage pour la prise ! 💪",
  cancelled: "annulée",
};

/* ---------- recherche produits (stock) ---------- */
async function searchProducts(tokens: string[]) {
  const { publicServerClient } = await import("./supabase-public.server");
  const { normalizeText } = await import("./catalogue-csv");
  const { data } = await publicServerClient()
    .from("products")
    .select("title,slug,price,stock_quantity,brand")
    .eq("status", "published")
    .limit(300);
  const scored = (data ?? [])
    .map((p) => {
      const hay = normalizeText(`${p.title} ${p.brand}`);
      const score = tokens.filter((t) => hay.includes(t)).length;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(({ p }) => ({
    title: p.title as string,
    slug: p.slug as string,
    price: p.price as number,
    stock: p.stock_quantity as number,
  }));
}

/* ---------- transcription pour le handoff ---------- */
function transcriptSummary(history: { role: string; text: string }[] | undefined, last: string) {
  const lines = (history ?? []).slice(-6).map((h) => `${h.role === "user" ? "Client" : "Assistant"} : ${h.text}`);
  lines.push(`Client : ${last}`);
  return lines.join("\n");
}

/* ---------- réponses par intention ---------- */
async function buildReply(
  intent: Intent,
  message: string,
  persona: Persona,
  lang: Lang,
  history: { role: string; text: string }[] | undefined,
): Promise<Reply> {
  const name = persona === "saad" ? "Saad" : "Jihane";

  switch (intent) {
    case "greeting": {
      return {
        messages: [
          tone(
            say(
              lang,
              `Hey, ${name} ici ! Je peux suivre votre commande, vérifier un stock ou vous aider sur la livraison. Que puis-je faire ?`,
              `Hey, ${name} here! I can track your order, check stock or help with delivery. What can I do?`,
              `مرحبا، ${name} هنا! يمكنني تتبع طلبك أو التحقق من المخزون أو مساعدتك في التوصيل. كيف أساعدك؟`,
            ),
            persona,
            lang,
          ),
        ],
        suggestions:
          lang === "en"
            ? ["Track my order", "Is a product in stock?", "Delivery info"]
            : lang === "ar"
              ? ["تتبع طلبي", "هل المنتج متوفر؟", "معلومات التوصيل"]
              : ["Suivre ma commande", "Produit en stock ?", "Infos livraison"],
      };
    }

    case "medical": {
      return {
        messages: [
          say(
            lang,
            "Question importante — mais je ne donne pas de conseil médical. Pour tout dosage, traitement ou problème de santé, consultez un médecin ou un professionnel de santé. 🩺",
            "Important question — but I can't give medical advice. For any dosage, treatment or health issue, please consult a doctor or healthcare professional. 🩺",
            "سؤال مهم — لكنني لا أقدم نصائح طبية. لأي جرعة أو علاج أو مشكلة صحية، استشر طبيبا أو مختصا. 🩺",
          ),
          say(
            lang,
            "Je peux en parler à l'équipe sur WhatsApp si vous voulez un orientement produit (sans conseil médical).",
            "I can pass this to the team on WhatsApp if you want product guidance (no medical advice).",
            "يمكنني إرسال هذا للفريق على واتساب إذا أردت توجيها حول المنتجات (بدون نصيحة طبية).",
          ),
        ],
        whatsappUrl: null,
        suggestions: [say(lang, "Contacter l'équipe", "Contact the team", "اتصل بالفريق")],
      };
    }

    case "order": {
      const number = extractOrderNumber(message);
      const phone = extractPhone(message);
      const { orderStore } = await import("./order-store.server");
      const store = orderStore();

      if (number && phone) {
        const order = store.tracking(number, phone);
        if (!order) {
          return {
            messages: [
              tone(
                say(
                  lang,
                  `Je ne trouve pas de commande ${number} avec ce téléphone. Vérifiez le numéro, ou je passe la main à l'équipe ?`,
                  `I can't find order ${number} with this phone. Double-check it, or shall I hand this to the team?`,
                  `لا أجد الطلب ${number} مع هذا الهاتف. تحقق من الرقم، أو أحوّلك للفريق؟`,
                ),
                persona,
                lang,
              ),
            ],
            suggestions: [say(lang, "Contacter l'équipe", "Contact the team", "اتصل بالفريق")],
          };
        }
        const state =
          lang === "en"
            ? `order ${order.orderNumber} is ${order.status}`.replace("shipped", "shipped and on its way 🚚")
            : lang === "ar"
              ? `الطلب ${order.orderNumber} : ${order.status}`
              : `votre commande ${order.orderNumber} est ${STATUS_FR[order.status] ?? order.status}`;
        return {
          messages: [
            tone(
              say(
                lang,
                `Je vérifie... C'est bon : ${state}. Total ${Math.round(order.total)} MAD, paiement ${order.paymentStatus === "paid" ? "déjà encaissé" : "à la livraison"}.`,
                `Checking... Got it: ${state}. Total ${Math.round(order.total)} MAD, payment ${order.paymentStatus === "paid" ? "already collected" : "cash on delivery"}.`,
                `جاري التحقق... تم: ${state}. المجموع ${Math.round(order.total)} درهم، الدفع ${order.paymentStatus === "paid" ? "محصّل" : "عند التسليم"}.`,
              ),
              persona,
              lang,
            ),
          ],
          suggestions: [say(lang, "Contacter l'équipe", "Contact the team", "اتصل بالفريق")],
        };
      }

      if (phone) {
        const orders = store.listByPhone(phone);
        if (!orders.length) {
          return {
            messages: [
              tone(
                say(
                  lang,
                  "Aucune commande sur ce numéro. Vérifiez, ou je passe la main à l'équipe WhatsApp ?",
                  "No orders on this number. Double-check, or shall I pass this to the WhatsApp team?",
                  "لا توجد طلبات على هذا الرقم. تحقق، أو أحوّلك لفريق واتساب؟",
                ),
                persona,
                lang,
              ),
            ],
          };
        }
        const list = orders
          .map((o) => `• ${o.orderNumber} — ${o.status} — ${Math.round(o.total)} MAD`)
          .join("\n");
        return {
          messages: [
            tone(
              say(lang, `J'ai trouvé ${orders.length} commande(s) :`, `Found ${orders.length} order(s):`, `وجدت ${orders.length} طلب(ات):`) + "\n" + list,
              persona,
              lang,
            ),
          ],
          suggestions: [say(lang, "Contacter l'équipe", "Contact the team", "اتصل بالفريق")],
        };
      }

      if (number) {
        return {
          messages: [
            tone(
              say(
                lang,
                `J'ai repéré la commande ${number} — il me faut aussi le téléphone utilisé pour la commande (sécurité).`,
                `I found order ${number} — I also need the phone number used (for security).`,
                `وجدت الطلب ${number} — أحتاج أيضا الهاتف المستخدم في الطلب (للأمان).`,
              ),
              persona,
              lang,
            ),
          ],
        };
      }

      return {
        messages: [
          tone(
            say(
              lang,
              "Avec plaisir ! Donnez-moi votre numéro de commande (PS-…) ou votre téléphone.",
              `Sure! Give me your order number (PS-…) or your phone number.`,
              "بكل سرور! أعطني رقم طلبك (PS-…) أو رقم هاتفك.",
            ),
            persona,
            lang,
          ),
        ],
      };
    }

    case "stock": {
      const tokens = productTokens(message);
      const products = tokens.length ? await searchProducts(tokens) : [];
      if (!products.length) {
        return {
          messages: [
            tone(
              say(
                lang,
                "Je ne trouve pas ce produit en catalogue. Je note la demande et je la passe à l'équipe — ou précisez le nom ?",
                "I can't find that product in the catalog. I'll note the request for the team — or give me a more specific name?",
                "لا أجد هذا المنتج في الكتالوغ. أسجل الطلب للفريق — أو أعطني اسما أدق؟",
              ),
              persona,
              lang,
            ),
          ],
          suggestions: [say(lang, "Contacter l'équipe", "Contact the team", "اتصل بالفريق")],
        };
      }
      return {
        messages: [
          tone(
            say(
              lang,
              "Voici ce que j'ai trouvé en stock :",
              "Here's what I found in stock:",
              "إليك ما وجدته في المخزون:",
            ),
            persona,
            lang,
          ),
          ...products
            .filter((p) => p.stock > 0)
            .map((p) =>
              say(
                lang,
                `✅ ${p.title} — ${Math.round(p.price)} MAD (${p.stock} en stock)`,
                `✅ ${p.title} — ${Math.round(p.price)} MAD (${p.stock} in stock)`,
                `✅ ${p.title} — ${Math.round(p.price)} درهم (${p.stock} في المخزون)`,
              ),
            ),
          ...products
            .filter((p) => p.stock <= 0)
            .map((p) =>
              say(
                lang,
                `❌ ${p.title} — indisponible pour le moment. Je peux prévenir l'équipe pour vous prévenir au réassort.`,
                `❌ ${p.title} — currently out of stock. I can tell the team to notify you on restock.`,
                `❌ ${p.title} — غير متوفر حاليا. يمكنني إبلاغ الفريق لإشعارك عند التوفر.`,
              ),
            ),
        ],
        products,
        suggestions: [say(lang, "Voir la boutique", "Browse the shop", "تصفح المتجر")],
      };
    }

    case "delivery": {
      return {
        messages: [
          tone(
            say(
              lang,
              "Livraison : 20 MAD à Kénitra, 30 MAD ailleurs au Maroc, gratuite dès 500 MAD. Délais : 24-48 h Kénitra/Rabat, 48-72 h ailleurs. Paiement à la livraison partout.",
              "Delivery: 20 MAD in Kénitra, 30 MAD elsewhere in Morocco, free from 500 MAD. Times: 24-48 h Kénitra/Rabat, 48-72 h elsewhere. Cash on delivery everywhere.",
              "التوصيل: 20 درهم بالقنيطرة، 30 درهم باقي المدن، مجاني من 500 درهم. المدة: 24-48 ساعة القنيطرة/الرباط، 48-72 ساعة ailleurs. الدفع عند التسليم في كل المغرب.",
            ),
            persona,
            lang,
          ),
        ],
        suggestions: [say(lang, "Suivre ma commande", "Track my order", "تتبع طلبي")],
      };
    }

    case "payment": {
      return {
        messages: [
          tone(
            say(
              lang,
              "Tout est en paiement à la livraison (espèces) : vous ne payez qu'à la réception, aucun paiement en ligne.",
              "Everything is cash on delivery: you only pay on reception, no online payment.",
              "كل شيء بالدفع عند التسليم (نقدا): تدفع فقط عند الاستلام، لا دفع عبر الإنترنت.",
            ),
            persona,
            lang,
          ),
        ],
      };
    }

    case "handoff":
    default: {
      const { whatsappUrl } = await import("./whatsapp");
      const transcript = transcriptSummary(history, message);
      const url = whatsappUrl(
        say(
          lang,
          `Bonjour PROTEIN STORE® 👋 Demande transférée par l'assistant ${name} :\n${transcript}`,
          `Hello PROTEIN STORE® 👋 Request transferred by the ${name} assistant:\n${transcript}`,
          `مرحبا PROTEIN STORE® 👋 طلب محوّل من المساعد ${name}:\n${transcript}`,
        ),
      );
      return {
        messages: [
          tone(
            say(
              lang,
              "Je note tout et je transmets à l'équipe sur WhatsApp Business — cliquez sur le bouton pour confirmer l'envoi, ils vous répondent rapidement.",
              "I've noted everything and I'm passing it to the team on WhatsApp Business — tap the button to confirm sending, they'll get back to you quickly.",
              "سجلّت كل شيء وأحوّله للفريق على واتساب بيزنس — اضغط الزر لتأكيد الإرسال وسيجيبونك بسرعة.",
            ),
            persona,
            lang,
          ),
        ],
        whatsappUrl: url,
      };
    }
  }
}

export const assistantReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { takeToken } = await import("./rate-limit");
    const { clientKey } = await import("./rate-limit.server");
    if (!takeToken(`assistant:${clientKey()}`, 40, 10 * 60_000).ok) {
      return {
        messages: [
          say(
            data.lang,
            "Trop de messages d'un coup — écrivez-nous directement sur WhatsApp Business pour une réponse immédiate.",
            "Too many messages at once — reach us directly on WhatsApp Business for an instant reply.",
            "رسائل كثيرة دفعة واحدة — راسلنا مباشرة على واتساب بيزنس للرد الفوري.",
          ),
        ],
        suggestions: [],
      };
    }
    const intent = detectIntent(data.message);
    return buildReply(intent, data.message, data.persona, data.lang, data.history);
  });
