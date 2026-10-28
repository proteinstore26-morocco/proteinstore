// Assistant IA ProteinStore — bulle d'accueil + chat avec personas Saad/Jihane.
// Photos réelles avec attitudes animées selon l'intention (mood) + fallback SVG.
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { X, Send, RefreshCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { assistantReply } from "@/lib/assistant.functions";
import { STATIC_MODE } from "@/lib/static-mode";
import { useI18n } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/whatsapp";

type Persona = "saad" | "jihane";
type Mood = "wave" | "happy" | "sorry" | "thinking" | "call" | "idle";
type Msg = { role: "user" | "assistant"; text: string };
type Products = { title: string; slug: string; price: number; stock: number };

const MOOD_EMOJI: Record<Mood, string> = {
  wave: "👋",
  happy: "💪",
  sorry: "😔",
  thinking: "🤔",
  call: "📞",
  idle: "✨",
};

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
  fr: { placeholder: "Écrivez votre message…", send: "Envoyer", toWhatsApp: "Envoyer à l'équipe sur WhatsApp", team: "Équipe" },
  en: { placeholder: "Type your message…", send: "Send", toWhatsApp: "Send to the team on WhatsApp", team: "Team" },
  ar: { placeholder: "اكتب رسالتك…", send: "إرسال", toWhatsApp: "أرسل للفريق على واتساب", team: "الفريق" },
} as const;

function Avatar({ persona, mood = "idle", size = 40 }: { persona: Persona; mood?: Mood; size?: number }) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-white/20 avatar-sway`}
      style={{ width: size, height: size }}
      key={`${persona}-${mood}`}
    >
      <img
        src={`/avatars/${persona}.png`}
        alt={persona}
        className={`avatar-photo avatar-mood-${mood}`}
      />
      <span className="absolute bottom-0 end-0 grid size-[45%] place-items-center rounded-full bg-background/85 text-[45%] leading-none">
        {MOOD_EMOJI[mood]}
      </span>
    </span>
  );
}

export function AssistantWidget() {
  if (STATIC_MODE) return null; // l'assistant a besoin du backend (indisponible en statique)
  const { lang } = useI18n();
  const reply = useServerFn(assistantReply);
  const ui = UI[lang] ?? UI.fr;
  const [persona, setPersona] = useState<Persona>("saad");
  const [mood, setMood] = useState<Mood>("wave");
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
  }, [messages, products, waLink, suggestions, busy]);

  function dismiss() {
    sessionStorage.setItem("ps_assistant_dismissed", "1");
    setBubble(false);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    setSuggestions([]);
    setMood("thinking");
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", text: clean }]);
    setBusy(true);
    try {
      const res = await reply({
        data: { message: clean, persona, lang, history },
      });
      setMood(res.mood ?? "idle");
      setMessages((m) => [...m, ...res.messages.map((text) => ({ role: "assistant" as const, text }))]);
      setProducts(res.products ?? null);
      setWaLink(res.whatsappUrl ?? null);
      setSuggestions(res.suggestions ?? []);
    } catch {
      setMood("sorry");
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
            <Avatar persona={persona} mood={mood} size={44} />
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

      {/* Bouton photo flottant */}
      {!open && (
        <button
          aria-label="Assistant ProteinStore"
          onClick={() => {
            setOpen(true);
            setBubble(false);
          }}
          className="fixed bottom-5 start-5 z-40 grid size-14 place-items-center rounded-full border-2 border-primary/60 bg-background shadow-xl transition-transform hover:scale-110"
        >
          <Avatar persona={persona} mood={mood} size={52} />
          <span className="absolute -end-0.5 -top-0.5 size-3.5 rounded-full border-2 border-background bg-success" />
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div className="fixed bottom-5 start-5 z-50 flex h-[600px] max-h-[85dvh] w-[min(390px,92vw)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          {/* Photo pleine avec humeur */}
          <div className="relative h-44 shrink-0 overflow-hidden bg-black">
            <img
              key={`${persona}-${mood}`}
              src={`/avatars/${persona}.png`}
              alt={`${name} — assistant PROTEIN STORE®`}
              className={`avatar-photo avatar-mood-${mood} h-full w-full`}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
              <Avatar persona={persona} mood={mood} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="flex items-center gap-1 text-[10px] text-success">
                  <span className="size-1.5 rounded-full bg-success" /> {ui.team} · WhatsApp
                </p>
              </div>
              <div className="flex overflow-hidden rounded-full border border-white/20">
                {(["saad", "jihane"] as Persona[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPersona(p)}
                    aria-label={NAME[p][lang]}
                    className={`px-1 py-1 transition-opacity ${persona === p ? "bg-primary/40" : "opacity-60 hover:opacity-100"}`}
                  >
                    <img src={`/avatars/${p}.png`} alt={NAME[p][lang]} className="size-6 rounded-full object-cover object-top" />
                  </button>
                ))}
              </div>
              <button aria-label="Fermer" onClick={() => setOpen(false)} className="p-1 text-white/80 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <span className="absolute end-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-background/85 text-lg shadow">
              {MOOD_EMOJI[mood]}
            </span>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-card p-3 text-sm">👋 {bubbleText}</div>
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
                setMood("wave");
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
