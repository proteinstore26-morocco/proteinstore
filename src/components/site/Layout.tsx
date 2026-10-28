import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
  Instagram,
  MessageCircle,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useCart, itemKey } from "@/lib/cart";
import { mad, FREE_SHIPPING_THRESHOLD, shippingFor } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { STATIC_MODE } from "@/lib/static-mode";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/whatsapp";

export const INSTAGRAM = "https://www.instagram.com/proteinestore";

const messages = [
  "🚚 Livraison partout au Maroc — Paiement à la livraison",
  "🔥 Soldes jusqu'à -40%",
  "✅ 100% Authentique — Testé en laboratoire",
];

export function AnnouncementBar() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setI((x) => (x + 1) % messages.length), 4000);
    return () => clearInterval(timer);
  }, []);
  if (hidden) return null;
  return (
    <div className="relative bg-primary py-2 text-center text-xs font-semibold tracking-wide text-primary-foreground md:text-sm">
      <span key={i} className="inline-block animate-fade-up">
        {t(messages[i] ?? "")}
      </span>
      <button
        aria-label="Fermer"
        onClick={() => setHidden(true)}
        className="absolute end-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

const nav = [
  { to: "/shop", label: "Boutique" },
  { to: "/partners", label: "Partenaires" },
  { to: "/about", label: "À propos" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Suivi" },
] as const;

export function Header() {
  const { count, setOpen } = useCart();
  const { user, isManager } = useAuth();
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${scrolled ? "border-b bg-background/85 backdrop-blur-xl" : "bg-transparent"}`}
    >
      <div className="container-ps flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo PROTEIN STORE®"
            className="size-10 rounded-full ring-1 ring-white/15"
          />
          <span className="headline text-lg md:text-xl">
            PROTEIN STORE<span className="text-primary">®</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {t(n.label)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link to="/shop" aria-label="Rechercher" className="rounded-full p-2 hover:bg-secondary">
            <Search className="size-5" />
          </Link>
          {isManager && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {!STATIC_MODE && (
            <Link
              to={user ? "/account" : "/auth"}
              aria-label={user ? "Mon compte" : "Connexion"}
              title={user ? "Mon compte" : "Connexion"}
              className="rounded-full p-2 hover:bg-secondary"
            >
              <User className="size-5" />
            </Link>
          )}
          <button
            aria-label="Panier"
            onClick={() => setOpen(true)}
            className="relative rounded-full p-2 hover:bg-secondary"
          >
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] font-bold">
                {count}
              </span>
            )}
          </button>
          <LanguageSwitcher compact />
          <button
            aria-label="Menu"
            onClick={() => setMenu(true)}
            className="rounded-full p-2 hover:bg-secondary md:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background p-6 md:hidden">
          <button aria-label="Fermer" onClick={() => setMenu(false)} className="self-end p-2">
            <X className="size-6" />
          </button>
          <nav className="mt-8 flex flex-col gap-6">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenu(false)}
                className="headline text-4xl"
              >
                {t(n.label)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, setQty, remove, subtotal } = useCart();
  const { t } = useI18n();
  const ship = shippingFor(subtotal);
  const left = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="headline text-2xl">{t("Votre panier")}</SheetTitle>
        </SheetHeader>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag className="size-16 text-muted-foreground" />
            <p className="text-muted-foreground">{t("Votre panier est vide.")}</p>
            <Button asChild onClick={() => setOpen(false)}>
              <Link to="/shop">{t("Découvrir la boutique")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="px-4">
              <p className="text-sm text-muted-foreground">
                {left > 0 ? (
                  <>
                    {t("Plus que")} <b className="text-foreground">{mad(left)}</b>{" "}
                    {t("pour la livraison gratuite")}
                  </>
                ) : (
                  t("🎉 Livraison gratuite débloquée")
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {items.map((i) => (
                <div key={itemKey(i)} className="flex gap-3">
                  <img src={i.image} alt={i.title} className="size-20 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{i.title}</p>
                    {i.flavor && <p className="text-xs text-muted-foreground">{i.flavor}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border">
                        <button
                          aria-label="Moins"
                          className="p-1.5"
                          onClick={() => setQty(itemKey(i), i.qty - 1)}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm">{i.qty}</span>
                        <button
                          aria-label="Plus"
                          className="p-1.5"
                          onClick={() => setQty(itemKey(i), i.qty + 1)}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="font-mono text-sm">{mad(i.unitPrice * i.qty)}</span>
                    </div>
                  </div>
                  <button
                    aria-label="Retirer"
                    onClick={() => remove(itemKey(i))}
                    className="self-start text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Sous-total")}</span>
                <span className="font-mono">{mad(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Livraison")}</span>
                <span className="font-mono">{ship ? mad(ship) : t("Gratuite")}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>{t("Total")}</span>
                <span className="font-mono">{mad(subtotal + ship)}</span>
              </div>
              <Button asChild size="lg" className="mt-2 w-full" onClick={() => setOpen(false)}>
                <Link to="/checkout">{t("Passer la commande")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t bg-card">
      <div className="container-ps grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Logo PROTEIN STORE®"
              className="size-9 rounded-full ring-1 ring-white/15"
            />
            <p className="headline text-xl">
              PROTEIN STORE<span className="text-primary">®</span>
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            THE STANDARD. No Fakes. No Excuses. Just Results.
          </p>
          <p className="mt-4 inline-block rounded-full border px-3 py-1 text-xs">
            {t("💵 Paiement à la livraison")}
          </p>
        </div>
        <FooterCol
          title={t("Boutique")}
          links={[
            ["/shop", t("Tous les produits")],
            ["/partners", t("Salles partenaires")],
            ["/track-order", t("Suivre ma commande")],
          ]}
        />
        <FooterCol
          title={t("Entreprise")}
          links={[
            ["/about", t("À propos")],
            ["/contact", "Contact"],
            ["/account", t("Mon compte")],
          ]}
        />
        <div>
          <p className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold uppercase tracking-wider">
            Contact <LanguageSwitcher />
          </p>
          <p className="text-sm text-muted-foreground">Kénitra, Maroc</p>
          <a
            href={whatsappUrl("Bonjour PROTEIN STORE® 👋")}
            className="mt-2 block text-sm font-medium hover:text-primary"
          >
            💬 WhatsApp Business
          </a>
          <div className="mt-4 flex gap-3">
            <a
              href={INSTAGRAM}
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-secondary p-2 hover:bg-primary"
            >
              <Instagram className="size-4" />
            </a>
            <a
              href={whatsappUrl("Bonjour PROTEIN STORE® 👋")}
              aria-label="WhatsApp"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-secondary p-2 hover:bg-primary"
            >
              <MessageCircle className="size-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PROTEIN STORE® — {t("Tous droits réservés")}
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wider">{title}</p>
      <ul className="space-y-2">
        {links.map(([to, l]) => (
          <li key={to}>
            <a href={to} className="text-sm text-muted-foreground hover:text-foreground">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhatsAppFab() {
  return (
    <a
      href={whatsappUrl("Bonjour PROTEIN STORE® 👋")}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 end-5 z-40 grid size-14 place-items-center rounded-full bg-success text-background shadow-lg transition-transform hover:scale-110"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
