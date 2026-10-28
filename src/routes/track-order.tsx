import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MessageCircle, PackageCheck, Truck, XCircle } from "lucide-react";
import { trackOrder } from "@/lib/orders.functions";
import { STATUS_LABELS, type PublicOrder } from "@/lib/order-types";
import { mad } from "@/lib/pricing";
import { buildTrackingMessage, whatsappUrl, WHATSAPP_DISPLAY } from "@/lib/whatsapp";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Suivi de commande — PROTEIN STORE®" },
      {
        name: "description",
        content: "Suivez votre commande avec votre numéro et votre téléphone.",
      },
      { property: "og:title", content: "Suivi de commande — PROTEIN STORE®" },
      { property: "og:description", content: "Où en est votre commande ?" },
    ],
  }),
  component: Track,
});

const STEPS = [
  { status: "pending", label: "Reçue", icon: PackageCheck },
  { status: "confirmed", label: "Confirmée", icon: CheckCircle2 },
  { status: "shipped", label: "Expédiée", icon: Truck },
  { status: "delivered", label: "Livrée", icon: CheckCircle2 },
] as const;

function Track() {
  const { t } = useI18n();
  const [result, setResult] = useState<PublicOrder | null>(null);
  const [results, setResults] = useState<PublicOrder[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup(payload: { order_number?: string | undefined; phone?: string | undefined }) {
    setBusy(true);
    setError("");
    try {
      const data = await trackOrder({ data: payload });
      setResults(data.orders);
      setResult(data.orders.length === 1 ? (data.orders[0] ?? null) : null);
      setSearched(true);
    } catch (lookupError) {
      console.error("[track] lookup failed", lookupError);
      setError("Suivi momentanément indisponible. Réessayez dans un instant.");
      setSearched(false);
    }
    setBusy(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const n = String(form.get("n") ?? "").trim();
    const p = String(form.get("p") ?? "").trim();
    await lookup({
      ...(n ? { order_number: n } : {}),
      ...(p ? { phone: p } : {}),
    });
  }

  const stepIndex = result ? STEPS.findIndex((step) => step.status === result.status) : -1;
  const cancelled = result?.status === "cancelled";

  return (
    <main className="container-ps section-ps max-w-3xl">
      <h1 className="headline text-5xl">Suivi de commande</h1>
      <p className="mt-4 text-muted-foreground">
        {t(
          "Entrez votre numéro de commande et votre téléphone — ou seulement votre téléphone pour retrouver toutes vos commandes. Le suivi est mis à jour par la boutique à chaque étape.",
        )}
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          name="n"
          placeholder="N° de commande (PS-…)"
          maxLength={40}
          aria-label="Numéro de commande"
        />
        <Input
          name="p"
          placeholder="Téléphone utilisé"
          maxLength={30}
          aria-label="Téléphone"
          inputMode="tel"
        />
        <Button disabled={busy}>
          <MessageCircle className="mr-2 size-4" />
          {busy ? "Recherche…" : "Suivre"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {error}
        </p>
      )}

      {searched && !result && (results?.length ?? 0) > 1 && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            {results!.length} {t("commandes trouvées pour ce téléphone :")}
          </p>
          {results!.map((order) => {
            const idx = STEPS.findIndex((step) => step.status === order.status);
            return (
              <button
                key={order.orderNumber}
                onClick={() => {
                  setResult(order);
                  setResults(null);
                }}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50"
              >
                <span className="font-mono text-sm">{order.orderNumber}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("fr-MA")}
                </span>
                <Badge variant="outline">{t(STATUS_LABELS[order.status])}</Badge>
                <span className="font-mono">{mad(order.total)}</span>
                <span className="text-xs text-muted-foreground">
                  {order.status === "cancelled"
                    ? "—"
                    : `${Math.max(idx + 1, 1)}/4 étapes`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {searched && !result && (results?.length ?? 0) <= 1 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Aucune commande trouvée</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vérifiez le numéro et le téléphone, ou contactez-nous : nous retrouvons la commande
                ensemble.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <a
                  href={whatsappUrl("Bonjour PROTEIN STORE® 👋 Je souhaite suivre ma commande.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-2 size-4" />
                  Écrire sur WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-muted-foreground">{result.orderNumber}</p>
                <h2 className="headline mt-1 text-3xl">{t(STATUS_LABELS[result.status])}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Commandé le {new Date(result.createdAt).toLocaleDateString("fr-MA")} · Paiement{" "}
                  {result.paymentStatus === "paid" ? "encaissé" : "à la livraison"}
                </p>
              </div>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
                {result.status === "cancelled" ? "Annulée" : `${Math.max(stepIndex + 1, 1)}/4`}
              </span>
            </div>

            {cancelled ? (
              <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                Cette commande a été annulée. Contactez-nous si vous souhaitez la relancer.
              </p>
            ) : (
              <ol className="mt-6 grid gap-3 sm:grid-cols-4">
                {STEPS.map((step, index) => {
                  const reached = stepIndex >= index;
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.status}
                      className={`rounded-lg border p-3 text-sm ${reached ? "border-primary/50 bg-primary/10" : "border-border"}`}
                    >
                      <Icon
                        className={`size-5 ${reached ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <p className={`mt-2 font-medium ${reached ? "" : "text-muted-foreground"}`}>
                        {t(step.label)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">{t("Articles")}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {result.items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="flex justify-between gap-3">
                  <span>
                    {item.quantity} × {item.title}
                    {item.variant ? ` (${item.variant})` : ""}
                  </span>
                  <span className="shrink-0 font-mono">{mad(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              {result.discount > 0 && (
                <p className="flex justify-between text-success">
                  <span>Code promo {result.promoCode}</span>
                  <span>−{mad(result.discount)}</span>
                </p>
              )}
              <p className="flex justify-between text-base font-bold">
                <span>{t("Total")}</span>
                <span className="font-mono">{mad(result.total)}</span>
              </p>
            </div>
            {result.invoiceNumber && (
              <p className="mt-2 text-xs text-muted-foreground">
                Facture <span className="font-mono">{result.invoiceNumber}</span>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">Historique</h3>
            <ol className="mt-3 space-y-3 text-sm">
              {result.timeline.map((entry, index) => (
                <li key={`${entry.createdAt}-${index}`} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p>{entry.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("fr-MA")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild variant="outline" className="mt-5">
              <a
                href={whatsappUrl(buildTrackingMessage(result.orderNumber, ""))}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 size-4" />
                Une question ? WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </Button>
          </section>
        </div>
      )}
    </main>
  );
}
