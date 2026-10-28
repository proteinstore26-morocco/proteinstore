// i18n léger : FR (défaut) / EN / AR (RTL). Clés = texte français source.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "fr" | "en" | "ar";
const LANGS: Lang[] = ["fr", "en", "ar"];
const STORAGE_KEY = "ps_lang";

const en: Record<string, string> = {
  "Boutique": "Shop",
  "Partenaires": "Partners",
  "À propos": "About",
  "Contact": "Contact",
  "Suivi": "Tracking",
  "Panier": "Cart",
  "Mon compte": "My account",
  "Connexion": "Sign in",
  "Admin": "Admin",
  "🚚 Livraison partout au Maroc — Paiement à la livraison": "🚚 Delivery across Morocco — Cash on delivery",
  "🔥 Soldes jusqu'à -40%": "🔥 Sales up to -40%",
  "✅ 100% Authentique — Testé en laboratoire": "✅ 100% Authentic — Lab tested",
  "Votre panier": "Your cart",
  "Votre panier est vide.": "Your cart is empty.",
  "Découvrir la boutique": "Browse the shop",
  "pour la livraison gratuite": "away from free delivery",
  "Plus que": "Only",
  "🎉 Livraison gratuite débloquée": "🎉 Free delivery unlocked",
  "Sous-total": "Subtotal",
  "Livraison": "Delivery",
  "Gratuite": "Free",
  "Total": "Total",
  "Passer la commande": "Checkout",
  "Tous les produits": "All products",
  "Salles partenaires": "Partner gyms",
  "Suivre ma commande": "Track my order",
  "Entreprise": "Company",
  "Tous droits réservés": "All rights reserved",
  "💵 Paiement à la livraison": "💵 Cash on delivery",
  "Voir la boutique": "Shop now",
  "Suivre ma commande ": "Track my order",
  "Ajouter au panier": "Add to cart",
  "Indisponible": "Out of stock",
  "En stock": "In stock",
  "Commande": "Checkout",
  "Nom complet": "Full name",
  "Téléphone": "Phone",
  "Ville": "City",
  "Adresse": "Address",
  "Remarques": "Notes",
  "Paiement à la livraison": "Cash on delivery",
  "Vous payez en espèces à la réception. Aucun paiement en ligne.": "You pay cash on delivery. No online payment.",
  "Code promo salle partenaire": "Partner gym promo code",
  "Appliquer": "Apply",
  "Commander sur WhatsApp": "Order via WhatsApp",
  "Récapitulatif": "Summary",
  "Suivi de commande": "Order tracking",
  "Reçue": "Received",
  "Confirmée": "Confirmed",
  "Expédiée": "Shipped",
  "Livrée": "Delivered",
  "Connexion ": "Sign in",
  "Se connecter": "Sign in",
  "Mot de passe oublié ?": "Forgot password?",
  "Pas de compte ? Inscrivez-vous": "No account? Sign up",
  "Continuer avec Google": "Continue with Google",
  "Créer mon compte": "Create my account",
  "Rechercher…": "Search…",
  "Trier": "Sort",
  "Filtres": "Filters",
  "Bienvenue": "Welcome",
  "E-mail (optionnel)": "Email (optional)",
  "Renseignez vos coordonnées : la commande est enregistrée, puis WhatsApp s'ouvre avec le récapitulatif complet. Notre équipe confirme la livraison et vous payez en espèces à la réception.": "Fill in your details: the order is stored, then WhatsApp opens with the full summary. Our team confirms delivery and you pay cash on arrival.",
  "Livraison Kénitra 20 MAD · autres villes 30 MAD · gratuite dès 500 MAD.": "Kénitra delivery 20 MAD · other cities 30 MAD · free from 500 MAD.",
  "Membres des salles partenaires : votre code club s'applique directement.": "Partner gym members: your club code applies directly.",
  "Enregistrement de la commande…": "Placing the order…",
  "Entrez votre numéro de commande et votre téléphone — ou seulement votre téléphone pour retrouver toutes vos commandes. Le suivi est mis à jour par la boutique à chaque étape.": "Enter your order number and phone — or just your phone to find all your orders. The shop updates tracking at each step.",
  "commandes trouvées pour ce téléphone :": "orders found for this phone:",
  "Articles": "Items",
  "Code promo": "Promo code",
  "Identifiant ou e-mail": "Login or email",
  "E-mail": "Email",
  "Mot de passe": "Password",
  "Nom": "Name",
  "Envoyer le lien": "Send the link",
  "Retour à la connexion": "Back to sign in",
  "Déjà un compte ? Connectez-vous": "Already have an account? Sign in",
  "Un e-mail de confirmation vient de partir : confirmez votre adresse (obligatoire) pour activer votre compte. Vérifiez aussi les spams.": "A confirmation email is on its way: confirm your address (mandatory) to activate your account. Check spam too.",
  "Nutrition sportive": "Sports nutrition",
  "100% authentique.": "100% authentic.",
  "Kénitra · Depuis le Maroc": "Kénitra · From Morocco",
  "Whey, créatine, gainers, pré-workouts. Livraison partout au Maroc et paiement à la livraison.": "Whey, creatine, gainers, pre-workouts. Delivery across Morocco and cash on delivery.",
  "En attente": "Pending",
  "Annulée": "Cancelled",
};

const ar: Record<string, string> = {
  "Boutique": "المتجر",
  "Partenaires": "الشركاء",
  "À propos": "من نحن",
  "Contact": "اتصل بنا",
  "Suivi": "التتبع",
  "Panier": "السلة",
  "Mon compte": "حسابي",
  "Connexion": "تسجيل الدخول",
  "Admin": "الإدارة",
  "🚚 Livraison partout au Maroc — Paiement à la livraison": "🚚 التوصيل لجميع أنحاء المغرب — الدفع عند التسليم",
  "🔥 Soldes jusqu'à -40%": "🔥 تخفيضات حتى -40%",
  "✅ 100% Authentique — Testé en laboratoire": "✅ 100% أصلي — مختبر ومعتمد",
  "Votre panier": "سلتك",
  "Votre panier est vide.": "سلتك فارغة.",
  "Découvrir la boutique": "تصفح المتجر",
  "pour la livraison gratuite": "للتوصيل المجاني",
  "Plus que": "باقي",
  "🎉 Livraison gratuite débloquée": "🎉 تم تفعيل التوصيل المجاني",
  "Sous-total": "المجموع الفرعي",
  "Livraison": "التوصيل",
  "Gratuite": "مجانية",
  "Total": "المجموع",
  "Passer la commande": "إتمام الطلب",
  "Tous les produits": "كل المنتجات",
  "Salles partenaires": "الصالات الشريكة",
  "Suivre ma commande": "تتبع طلبي",
  "Entreprise": "الشركة",
  "Tous droits réservés": "جميع الحقوق محفوظة",
  "💵 Paiement à la livraison": "💵 الدفع عند التسليم",
  "Voir la boutique": "تسوق الآن",
  "Suivre ma commande ": "تتبع طلبي",
  "Ajouter au panier": "أضف إلى السلة",
  "Indisponible": "غير متوفر",
  "En stock": "متوفر",
  "Commande": "إتمام الطلب",
  "Nom complet": "الاسم الكامل",
  "Téléphone": "الهاتف",
  "Ville": "المدينة",
  "Adresse": "العنوان",
  "Remarques": "ملاحظات",
  "Paiement à la livraison": "الدفع عند التسليم",
  "Vous payez en espèces à la réception. Aucun paiement en ligne.": "تدفع نقدا عند الاستلام. لا دفع عبر الإنترنت.",
  "Code promo salle partenaire": "كود خصم النادي الشريك",
  "Appliquer": "تطبيق",
  "Commander sur WhatsApp": "اطلب عبر واتساب",
  "Récapitulatif": "ملخص الطلب",
  "Suivi de commande": "تتبع الطلب",
  "Reçue": "تم الاستلام",
  "Confirmée": "مؤكد",
  "Expédiée": "تم الشحن",
  "Livrée": "تم التسليم",
  "Connexion ": "تسجيل الدخول",
  "Se connecter": "تسجيل الدخول",
  "Mot de passe oublié ?": "نسيت كلمة المرور؟",
  "Pas de compte ? Inscrivez-vous": "ليس لديك حساب؟ سجل الآن",
  "Continuer avec Google": "المتابعة مع Google",
  "Créer mon compte": "إنشاء حساب",
  "Rechercher…": "بحث…",
  "Trier": "ترتيب",
  "Filtres": "تصفية",
  "Bienvenue": "مرحبا",
  "E-mail (optionnel)": "البريد الإلكتروني (اختياري)",
  "Renseignez vos coordonnées : la commande est enregistrée, puis WhatsApp s'ouvre avec le récapitulatif complet. Notre équipe confirme la livraison et vous payez en espèces à la réception.": "أدخل معلوماتك: يتم تسجيل الطلب ثم يفتح واتساب بالملخص الكامل. يؤكد فريقنا التوصيل وتدفع نقدا عند الاستلام.",
  "Livraison Kénitra 20 MAD · autres villes 30 MAD · gratuite dès 500 MAD.": "توصيل القنيطرة 20 درهم · مدن أخرى 30 درهم · مجاني من 500 درهم.",
  "Membres des salles partenaires : votre code club s'applique directement.": "أعضاء الصالات الشريكة: يتم تطبيق كود النادي مباشرة.",
  "Enregistrement de la commande…": "جاري تسجيل الطلب…",
  "Entrez votre numéro de commande et votre téléphone — ou seulement votre téléphone pour retrouver toutes vos commandes. Le suivi est mis à jour par la boutique à chaque étape.": "أدخل رقم الطلب وهاتفك — أو هاتفك فقط للعثور على جميع طلباتك. يتم تحديث التتبع من المتجر في كل مرحلة.",
  "commandes trouvées pour ce téléphone :": "طلبات لهذا الهاتف:",
  "Articles": "المنتجات",
  "Code promo": "كود الخصم",
  "Identifiant ou e-mail": "المعرف أو البريد الإلكتروني",
  "E-mail": "البريد الإلكتروني",
  "Mot de passe": "كلمة المرور",
  "Nom": "الاسم",
  "Envoyer le lien": "أرسل الرابط",
  "Retour à la connexion": "العودة لتسجيل الدخول",
  "Déjà un compte ? Connectez-vous": "لديك حساب؟ سجل دخولك",
  "Un e-mail de confirmation vient de partir : confirmez votre adresse (obligatoire) pour activer votre compte. Vérifiez aussi les spams.": "تم إرسال بريد التأكيد: أكد بريدك (إلزامي) لتفعيل حسابك. تحقق من البريد المزعج أيضا.",
  "Nutrition sportive": "تغذية رياضية",
  "100% authentique.": "100% أصلية.",
  "Kénitra · Depuis le Maroc": "القنيطرة · من المغرب",
  "Whey, créatine, gainers, pré-workouts. Livraison partout au Maroc et paiement à la livraison.": "واي، كرياتين، جينر، بري وركاوت. التوصيل لجميع أنحاء المغرب والدفع عند التسليم.",
  "En attente": "قيد الانتظار",
  "Annulée": "ملغاة",
};

const DICTS: Record<Exclude<Lang, "fr">, Record<string, string>> = { en, ar };

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string };
const I18nContext = createContext<I18n>({ lang: "fr", setLang: () => {}, t: (s) => s });

export function translate(lang: Lang, s: string): string {
  if (lang === "fr") return s;
  return DICTS[lang][s] ?? s;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.includes(saved)) setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang(l: Lang) {
        setLangState(l);
        localStorage.setItem(STORAGE_KEY, l);
      },
      t: (s: string) => translate(lang, s),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/* Drapeaux SVG (les emojis drapeaux ne s'affichent pas sous Windows) */
export function FlagFR({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={`${className} rounded-[3px] ring-1 ring-black/20`} aria-label="Français">
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
    </svg>
  );
}
export function FlagGB({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={`${className} rounded-[3px] ring-1 ring-black/20`} aria-label="English">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="3" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="2.6" />
    </svg>
  );
}
export function FlagMA({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={`${className} rounded-[3px] ring-1 ring-black/20`} aria-label="العربية">
      <rect width="24" height="16" fill="#C1272D" />
      <path
        d="M12 4.2 13.1 8l-2.6-2h3.2L10.9 8 12 4.2Zm-4.4 4.6 4.4-3.2 4.4 3.2-1.7 5.2h-5.4L7.6 8.8Z"
        fill="none"
        stroke="#006233"
        strokeWidth="0.9"
      />
      <path d="m12 5 1 3.2-2.8-2h3.6L11 8.2 12 5Z" fill="#006233" />
    </svg>
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const item = (l: Lang, flag: ReactNode, name: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-label={name}
      title={name}
      className={`grid place-items-center rounded-md p-1.5 transition-opacity ${
        lang === l ? "bg-secondary ring-1 ring-primary" : "opacity-60 hover:opacity-100"
      }`}
    >
      {flag}
    </button>
  );
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {item("ar", <FlagMA className="size-4" />, "العربية")}
        {item("fr", <FlagFR className="size-4" />, "Français")}
        {item("en", <FlagGB className="size-4" />, "English")}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {item("ar", <FlagMA />, "العربية")}
      {item("fr", <FlagFR />, "Français")}
      {item("en", <FlagGB />, "English")}
    </div>
  );
}
