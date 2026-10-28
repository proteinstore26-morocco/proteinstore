// Assistant IA ProteinStore — bulle d'accueil + chat avec personas Saad/Jihane.
// Réponses servies par src/lib/assistant.functions.ts (données réelles du store).
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { X, Send, RefreshCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { assistantReply } from "@/lib/assistant.functions";
import { useI18n } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/whatsapp";

type Persona = "saad" | "jihane";
type Msg = { role: "user" | "assistant"; text: string };
type Products = { title: string; slug: string; price: number; stock: number };

const NAME: Record<Persona, Record<"fr" | "en" | "ar", string>> = {
  saad: { fr: "Saad", en: "Saad", ar: "سعد" },
  jihane: { fr: "Jihane", en: "Jihane", ar: "جهان" },
};

const BUBBLE: Record<Persona, Record<"fr" | "en" | "ar", string>> = {
  saad: {
    fr: "Hey ! Je suis Saad. Besoin d'aide pour votre commande ou un produit ? 💪",
    en: "Hey! I'm Saad. Need help with your order or looking for a product? 💪",
    ar: "مرحبا! أنا سعد. تحتاج مساعدة في طلبك أو تبحث عن منتج؟ 💪",
  },
  jihane: {
    fr: "Hey ! Moi c'est Jihane. Besoin d'aide pour votre commande ou un produit ? 😊",
    en: "Hey! I'm Jihane. Need help with your order or looking for a product? 😊",
    ar: "مرحبا! أنا جهان. تحتاج مساعدة في طلبك أو تبحث عن منتج؟ 😊",
  },
};

const UI = {
  fr: { placeholder: "Écrivez votre message…", send: "Envoyer", toWhatsApp: "Envoyer à l'équipe sur WhatsApp", view: "Voir le produit", team: "Équipe" },
  en: { placeholder: "Type your message…", send: "Send", toWhatsApp: "Send to the team on WhatsApp", view: "View product", team: "Team" },
  ar: { placeholder: "اكتب رسالتك…", send: "إرسال", toWhatsApp: "أرسل للفريق على واتساب", view: "شاهد المنتج", team: "الفريق" },
} as const;

/* Avatars vectoriels — remplaçables par /avatars/saad.png & jihane.png */
function Avatar({ persona, size = 40 }: { persona: Persona; size?: number }) {
  return persona === "saad" ? (
    <svg viewBox="0 0 64 64" width={size} height={size} className="rounded-full" aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#111114" />
      <circle cx="32" cy="24" r="11" fill="#e8b98a" />
      <path d="M21 22c0-7 5-11 11-11s11 4 11 11c0-3-4-6-11-6s-11 3-11 6Z" fill="#2a1d12" />
      <path d="M25 25c0 5 3 8 7 8s7-3 7-8c0 2-14 2-14 0Z" fill="#3a2a1a" opacity=".6" />
      <path d="M12 62c1-14 9-22 20-22s19 8 20 22Z" fill="#a3e635" />
      <path d="M27 41h10v6H27z" fill="#e8b98a" />
    </svg>
  ) : (
    <svg viewBox="0 0 64 64" width={size} height={size} className="rounded-full" aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#111114" />
      <circle cx="32" cy="24" r="11" fill="#f0c9a0" />
      <path d="M20 26c0-9 5-14 12-14s12 5 12 14c1 6-2 12-4 14l1-8c-4 3-14 3-17-1l-1 8c-2-2-4-7-3-13Z" fill="#4a2f1d" />
      <circle cx="24" cy="44" r="4" fill="#9ca3af" />
      <path d="M13 62c1-13 9-20 19-20s18 7 19 20Z" fill="#9ca3af" />
      <path d="M28 43h8v5h-8z" fill="#f0c9a0" />
    </svg>
  );
}

export function AssistantWidget() {
  const { lang } = useI18n();
  const reply = useServerFn(assistantReply);
  const ui = UI[lang] ?? UI.fr;
  const [persona, setPersona] = useState<Persona>("saad");
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [products, setProducts] = useState<Products[] | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!sessionStorage.getItem("ps_assistant_dismissed")) setBubble(true);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, products, waLink, suggestions]);

  function dismiss() {
    sessionStorage.setItem("ps_assistant_dismissed", "1");
    setBubble(false);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    setSuggestions([]);
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", text: clean }]);
    setBusy(true);
    try {
      const res = await reply({
        data: { message: clean, persona, lang, history },
      });
      setMessages((m) => [...m, ...res.messages.map((text) => ({ role: "assistant" as const, text }))]);
      setProducts(res.products ?? null);
      setWaLink(res.whatsappUrl ?? null);
      setSuggestions(res.suggestions ?? []);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            lang === "en"
              ? "I'm having a hiccup — reach the team on WhatsApp Business."
              : lang === "ar"
                ? "عندي عطل صغير — راسل الفريق على واتساب بيزنس."
                : "J'ai un petit souci — contactez l'équipe sur WhatsApp Business.",
        },
      ]);
    }
    setBusy(false);
  }

  const name = NAME[persona][lang] ?? persona;
  const bubbleText = BUBBLE[persona][lang] ?? BUBBLE[persona].fr;

  return (
    <>
      {/* Bulle d'accueil */}
      {bubble && !open && (
        <div className="fixed bottom-24 start-5 z-40 flex max-w-[300px] items-end gap-2">
          <button
            onClick={() => {
              setOpen(true);
              dismiss();
            }}
            className="flex items-center gap-2 rounded-2xl border bg-card p-3 text-start text-sm shadow-xl transition-transform hover:scale-[1.02]"
          >
            <Avatar persona={persona} size={36} />
            <span>{bubbleText}</span>
          </button>
          <button
            aria-label="Fermer"
            onClick={dismiss}
            className="grid size-6 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Bouton avatar flottant */}
      {!open && (
        <button
          aria-label="Assistant ProteinStore"
          onClick={() => {
            setOpen(true);
            setBubble(false);
          }}
          className="fixed bottom-5 start-5 z-40 grid size-14 place-items-center rounded-full border-2 border-primary/60 bg-background shadow-xl transition-transform hover:scale-110"
        >
          <Avatar persona={persona} size={52} />
          <span className="absolute -end-0.5 -top-0.5 size-3.5 rounded-full border-2 border-background bg-success" />
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div className="fixed bottom-5 start-5 z-50 flex h-[560px] max-h-[80dvh] w-[min(380px,92vw)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center gap-3 border-b bg-card p-3">
            <Avatar persona={persona} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{name}</p>
              <p className="flex items-center gap-1 text-[11px] text-success">
                <span className="size-1.5 rounded-full bg-success" /> {ui.team} · WhatsApp
              </p>
            </div>
            <div className="flex overflow-hidden rounded-full border">
              {(["saad", "jihane"] as Persona[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPersona(p)}
                  aria-label={NAME[p][lang]}
                  className={`px-1.5 py-1 transition-opacity ${persona === p ? "bg-primary/20" : "opacity-50 hover:opacity-100"}`}
                >
                  <Avatar persona={p} size={24} />
                </button>
              ))}
            </div>
            <button aria-label="Fermer" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-card p-3 text-sm">
                👋 {bubbleText}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-line rounded-xl p-3 text-sm ${
                  m.role === "user"
                    ? "ms-auto bg-primary text-primary-foreground"
                    : "bg-card border"
                }`}
              >
                {m.text}
              </div>
            ))}
            {products && products.length > 0 && (
              <div className="space-y-2">
                {products.map((p) => (
                  <Link
                    key={p.slug}
                    to="/product/$slug"
                    params={{ slug: p.slug }}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 text-xs hover:border-primary/60"
                  >
                    <span className="line-clamp-2">{p.title}</span>
                    <span className="shrink-0 font-mono">{Math.round(p.price)} MAD</span>
                  </Link>
                ))}
              </div>
            )}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl bg-[#25d366] p-3 text-center text-sm font-bold text-[#052e16]"
              >
                {ui.toWhatsApp}
              </a>
            )}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-primary/50 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && <p className="animate-pulse text-xs text-muted-foreground">•••</p>}
          </div>

          <form
            className="flex items-center gap-2 border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ui.placeholder}
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              aria-label={ui.send}
              disabled={busy || !input.trim()}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Effacer la conversation"
              title="Effacer"
              onClick={() => {
                setMessages([]);
                setProducts(null);
                setWaLink(null);
                setSuggestions([]);
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <RefreshCcw className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
