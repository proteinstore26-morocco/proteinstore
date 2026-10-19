import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminInvoices,
  getAdminOrder,
  sendCustomerMessage,
  setInvoiceStatus,
} from "@/lib/store.functions";
import type { InvoiceSummary } from "@/lib/order-types";
import { buildInvoiceMessage } from "@/lib/whatsapp";
import { mad } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceDocument } from "./InvoiceDocument";
import { WhatsAppModal, type WhatsAppDraft } from "./WhatsAppModal";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
const tone = (status: string) =>
  status === "paid"
    ? "text-success border-success/30"
    : status === "void"
      ? "text-destructive border-destructive/30"
      : "text-foreground";

export function InvoicesPanel() {
  const listFn = useServerFn(getAdminInvoices);
  const orderFn = useServerFn(getAdminOrder);
  const statusFn = useServerFn(setInvoiceStatus);
  const messageFn = useServerFn(sendCustomerMessage);
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<InvoiceSummary | null>(null);
  const [wa, setWa] = useState<WhatsAppDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const invoices = useQuery({
    queryKey: ["admin", "invoices"],
    queryFn: () => listFn(),
    retry: false,
  });
  const order = useQuery({
    queryKey: ["admin", "invoice-order", selected?.orderId],
    queryFn: () => orderFn({ data: { id: selected?.orderId ?? "" } }),
    enabled: selected !== null,
    retry: false,
  });

  async function updateStatus(invoice: InvoiceSummary, status: "paid" | "void") {
    setBusy(true);
    try {
      const result = await statusFn({ data: { invoiceId: invoice.id, status } });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      setWa({
        phone: result.whatsapp.phone,
        message: result.whatsapp.message,
        customerName: result.invoice.customerName,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Facture non mise à jour.");
    } finally {
      setBusy(false);
    }
  }

  function resend(invoice: InvoiceSummary) {
    const message = buildInvoiceMessage({
      customerName: invoice.customerName,
      invoiceNumber: invoice.number,
      orderNumber: invoice.orderNumber,
      total: invoice.total,
    });
    setWa({ phone: invoice.customerPhone, message, customerName: invoice.customerName });
    void messageFn({
      data: { phone: invoice.customerPhone, body: message, orderId: invoice.orderId },
    });
  }

  const rows = invoices.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{rows.length} facture(s)</p>
        <Button
          variant="outline"
          onClick={() => void invoices.refetch()}
          disabled={invoices.isFetching}
        >
          Actualiser
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y text-xs uppercase text-muted-foreground">
            <tr>
              {["Facture", "Commande", "Client", "Émise le", "Total", "Statut", ""].map(
                (header) => (
                  <th key={header} className="px-3 py-3 font-medium">
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono">{invoice.number}</td>
                <td className="px-3 py-3 font-mono text-xs">{invoice.orderNumber}</td>
                <td className="px-3 py-3">
                  <p>{invoice.customerName}</p>
                  <p className="text-xs text-muted-foreground">{invoice.customerPhone}</p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{date(invoice.issuedAt)}</td>
                <td className="px-3 py-3 font-mono">{mad(invoice.total)}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={tone(invoice.status)}>
                    {invoice.status === "paid"
                      ? "Payée"
                      : invoice.status === "void"
                        ? "Annulée"
                        : "Émise"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(invoice)}>
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
          Aucune facture. Générez-la depuis le détail d'une commande.
        </p>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facture {selected?.number}</DialogTitle>
            <DialogDescription>
              {selected?.customerName} · commande {selected?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {selected && order.data && <InvoiceDocument invoice={selected} order={order.data} />}
          {order.isPending && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chargement de la commande…
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {selected && selected.status !== "paid" && (
              <Button disabled={busy} onClick={() => void updateStatus(selected, "paid")}>
                Marquer payée
              </Button>
            )}
            {selected && selected.status !== "void" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void updateStatus(selected, "void")}
              >
                Annuler la facture
              </Button>
            )}
            {selected && (
              <Button variant="outline" onClick={() => resend(selected)}>
                <MessageCircle /> Envoyer sur WhatsApp
              </Button>
            )}
            <Button onClick={() => window.print()} disabled={!order.data}>
              <Printer /> Imprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppModal draft={wa} onClose={() => setWa(null)} />
    </div>
  );
}
