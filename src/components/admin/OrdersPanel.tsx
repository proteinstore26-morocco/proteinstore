import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, MessageCircle, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import {
  addOrderNote,
  createOrderInvoice,
  getAdminOrder,
  getAdminOrders,
  sendCustomerMessage,
  setInvoiceStatus,
  updateOrderStatus,
} from "@/lib/store.functions";
import {
  ORDER_STATUSES,
  PAYMENT_LABELS,
  STATUS_LABELS,
  type InvoiceSummary,
  type OrderDetail,
  type OrderStatus,
} from "@/lib/order-types";
import { buildInvoiceMessage } from "@/lib/whatsapp";
import { mad } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceDocument } from "./InvoiceDocument";
import { WhatsAppModal, type WhatsAppDraft } from "./WhatsAppModal";

type Filter = OrderStatus | "all";
type PrintData = { invoice: InvoiceSummary; order: OrderDetail };

const statusTone = (status: OrderStatus) =>
  status === "delivered"
    ? "text-success border-success/30"
    : status === "cancelled"
      ? "text-destructive border-destructive/30"
      : status === "pending"
        ? "text-warning border-warning/30"
        : "text-foreground";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

export function OrdersPanel() {
  const listFn = useServerFn(getAdminOrders);
  const detailFn = useServerFn(getAdminOrder);
  const statusFn = useServerFn(updateOrderStatus);
  const noteFn = useServerFn(addOrderNote);
  const invoiceFn = useServerFn(createOrderInvoice);
  const invoiceStatusFn = useServerFn(setInvoiceStatus);
  const messageFn = useServerFn(sendCustomerMessage);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wa, setWa] = useState<WhatsAppDraft | null>(null);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [note, setNote] = useState("");
  const [freeMessage, setFreeMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const orders = useQuery({
    queryKey: ["admin", "orders", filter, search],
    queryFn: () =>
      listFn({
        data: { ...(filter !== "all" ? { status: filter } : {}), ...(search ? { q: search } : {}) },
      }),
    retry: false,
  });

  const detail = useQuery({
    queryKey: ["admin", "order", selectedId],
    queryFn: () => detailFn({ data: { id: selectedId ?? "" } }),
    enabled: selectedId !== null,
    retry: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  async function changeStatus(id: string, status: OrderStatus) {
    setBusy(true);
    try {
      const result = await statusFn({ data: { id, status } });
      await refresh();
      setWa({
        phone: result.whatsapp.phone,
        message: result.whatsapp.message,
        customerName: result.order.customerName,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Changement de statut impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(id: string) {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await noteFn({ data: { id, note } });
      setNote("");
      await detail.refetch();
      await refresh();
      toast.success("Note ajoutée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Note non enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  async function generateInvoice(order: OrderDetail) {
    setBusy(true);
    try {
      const result = await invoiceFn({ data: { orderId: order.id } });
      await detail.refetch();
      await refresh();
      setWa({
        phone: result.whatsapp.phone,
        message: result.whatsapp.message,
        customerName: result.invoice.customerName,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Facture impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function payInvoice(invoice: InvoiceSummary) {
    setBusy(true);
    try {
      const result = await invoiceStatusFn({ data: { invoiceId: invoice.id, status: "paid" } });
      await detail.refetch();
      await refresh();
      setWa({
        phone: result.whatsapp.phone,
        message: result.whatsapp.message,
        customerName: result.invoice.customerName,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paiement non enregistré.");
    } finally {
      setBusy(false);
    }
  }

  function invoiceFor(order: OrderDetail): InvoiceSummary | null {
    if (!order.invoice) return null;
    return {
      ...order.invoice,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total: order.total,
      orderStatus: order.status,
    };
  }

  const rows = orders.data ?? [];
  const order = detail.data ?? null;
  const invoice = order ? invoiceFor(order) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["all", ...ORDER_STATUSES] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary"
            }`}
          >
            {value === "all" ? "Toutes" : STATUS_LABELS[value]}
          </button>
        ))}
        <div className="relative min-w-48 flex-1">
          <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="N° commande, client, téléphone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Rechercher une commande"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching}
        >
          Actualiser
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{rows.length} commande(s)</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-y text-xs uppercase text-muted-foreground">
            <tr>
              {["Commande", "Client", "Date", "Total", "Paiement", "Statut", ""].map((header) => (
                <th key={header} className="px-3 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono">
                  {row.orderNumber}
                  {row.invoiceNumber && (
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {row.invoiceNumber}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <p>{row.customerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.customerPhone}</p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                <td className="px-3 py-3 font-mono">{mad(row.total)}</td>
                <td className="px-3 py-3 text-xs">{PAYMENT_LABELS[row.paymentStatus]}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={statusTone(row.status)}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)}>
                    Ouvrir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="py-14 text-center text-sm text-muted-foreground">
          Aucune commande pour ce filtre. Les nouvelles commandes arrivent ici dès le checkout.
        </p>
      )}

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Commande {order?.orderNumber ?? "…"}
              {order && (
                <Badge variant="outline" className={statusTone(order.status)}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {order
                ? `${formatDate(order.createdAt)} · ${order.customerPhone} · ${PAYMENT_LABELS[order.paymentStatus]}`
                : "Chargement…"}
            </DialogDescription>
          </DialogHeader>

          {detail.isPending && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chargement de la commande…
            </p>
          )}
          {detail.isError && (
            <p className="py-8 text-center text-sm text-destructive">Commande introuvable.</p>
          )}

          {order && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.filter((status) => status !== order.status).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "cancelled" ? "outline" : "default"}
                    disabled={busy}
                    onClick={() => void changeStatus(order.id, status)}
                  >
                    {STATUS_LABELS[status]}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setWa({
                      phone: order.customerPhone,
                      customerName: order.customerName,
                      message: `Bonjour ${order.customerName.split(" ")[0] || order.customerName},`,
                    })
                  }
                >
                  <MessageCircle /> Message libre
                </Button>
              </div>

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Client</p>
                  <p className="mt-1 font-medium">{order.customerName}</p>
                  <a href={`tel:${order.customerPhone}`} className="text-primary">
                    {order.customerPhone}
                  </a>
                  {order.customerEmail && (
                    <p className="break-all text-muted-foreground">{order.customerEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Livraison</p>
                  <p className="mt-1">{order.address}</p>
                  <p className="text-muted-foreground">{order.city}</p>
                  {order.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Note client : {order.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-y text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Article</th>
                      <th className="py-2 text-center">Qté</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          {item.productTitle}
                          {item.variant ? ` — ${item.variant}` : ""}
                        </td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right font-mono">{mad(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-end gap-6 text-sm">
                  <span className="text-muted-foreground">
                    Livraison {order.shipping ? mad(order.shipping) : "gratuite"}
                  </span>
                  <span className="font-bold">Total {mad(order.total)}</span>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Facture</p>
                  <div className="flex flex-wrap gap-2">
                    {invoice ? (
                      <>
                        <Badge variant="outline">
                          {invoice.number} ·{" "}
                          {invoice.status === "paid"
                            ? "payée"
                            : invoice.status === "void"
                              ? "annulée"
                              : "émise"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintData({ invoice, order })}
                        >
                          <Printer /> Imprimer
                        </Button>
                        {invoice.status !== "paid" && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void payInvoice(invoice)}
                          >
                            Marquer payée
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setWa({
                              phone: order.customerPhone,
                              customerName: order.customerName,
                              message: buildInvoiceMessage({
                                customerName: order.customerName,
                                invoiceNumber: invoice.number,
                                orderNumber: order.orderNumber,
                                total: order.total,
                              }),
                            })
                          }
                        >
                          Envoyer sur WhatsApp
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => void generateInvoice(order)}>
                        <FileText /> Générer la facture
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold">Historique</p>
                <ol className="mt-3 space-y-2 text-sm">
                  {order.events.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      <div>
                        <p>{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString("fr-MA")} · {event.type}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">Note interne</p>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Appel client, disponibilité, remarque livreur…"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={busy || !note.trim()}
                    onClick={() => void saveNote(order.id)}
                  >
                    Ajouter la note
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-semibold">Message client</p>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={freeMessage}
                    onChange={(event) => setFreeMessage(event.target.value)}
                    placeholder={`Bonjour ${order.customerName.split(" ")[0] || order.customerName}, …`}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!freeMessage.trim()}
                    onClick={() => {
                      setWa({
                        phone: order.customerPhone,
                        customerName: order.customerName,
                        message: freeMessage,
                      });
                      void messageFn({
                        data: { phone: order.customerPhone, body: freeMessage, orderId: order.id },
                      });
                      setFreeMessage("");
                    }}
                  >
                    <MessageCircle /> Préparer sur WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={printData !== null} onOpenChange={(open) => !open && setPrintData(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facture {printData?.invoice.number}</DialogTitle>
            <DialogDescription>
              Utilisez « Imprimer » puis « Enregistrer en PDF » pour archiver.
            </DialogDescription>
          </DialogHeader>
          {printData && <InvoiceDocument invoice={printData.invoice} order={printData.order} />}
          <div className="flex justify-end">
            <Button onClick={() => window.print()}>
              <Printer /> Imprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppModal draft={wa} onClose={() => setWa(null)} />
    </div>
  );
}
