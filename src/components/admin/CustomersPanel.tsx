import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { getAdminCustomer, getAdminCustomers, sendCustomerMessage } from "@/lib/store.functions";
import { STATUS_LABELS, type CustomerSummary } from "@/lib/order-types";
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
import { WhatsAppModal, type WhatsAppDraft } from "./WhatsAppModal";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

export function CustomersPanel() {
  const listFn = useServerFn(getAdminCustomers);
  const detailFn = useServerFn(getAdminCustomer);
  const messageFn = useServerFn(sendCustomerMessage);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerSummary | null>(null);
  const [body, setBody] = useState("");
  const [wa, setWa] = useState<WhatsAppDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const customers = useQuery({
    queryKey: ["admin", "customers", search],
    queryFn: () => listFn({ data: { ...(search ? { q: search } : {}) } }),
    retry: false,
  });

  const detail = useQuery({
    queryKey: ["admin", "customer", selected?.phoneNorm],
    queryFn: () => detailFn({ data: { phoneNorm: selected?.phoneNorm ?? "" } }),
    enabled: selected !== null,
    retry: false,
  });

  async function prepareMessage(customer: CustomerSummary) {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await messageFn({ data: { phone: customer.phone, body } });
      setWa({ phone: customer.phone, customerName: customer.name, message: body });
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message non enregistré.");
    } finally {
      setBusy(false);
    }
  }

  const rows = customers.data ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="Nom ou téléphone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Rechercher un client"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void customers.refetch()}
          disabled={customers.isFetching}
        >
          Actualiser
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{rows.length} client(s)</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-y text-xs uppercase text-muted-foreground">
            <tr>
              {["Client", "Ville", "Commandes", "Total dépensé", "Dernière commande", ""].map(
                (header) => (
                  <th key={header} className="px-3 py-3 font-medium">
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((customer) => (
              <tr key={customer.phoneNorm} className="hover:bg-muted/40">
                <td className="px-3 py-3">
                  <p className="font-medium">{customer.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{customer.phone}</p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{customer.city}</td>
                <td className="px-3 py-3">{customer.ordersCount}</td>
                <td className="px-3 py-3 font-mono">{mad(customer.totalSpent)}</td>
                <td className="px-3 py-3 text-muted-foreground">{date(customer.lastOrderAt)}</td>
                <td className="px-3 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(customer)}>
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
          Aucun client pour l'instant. Ils apparaissent automatiquement à la première commande.
        </p>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail.data?.name ?? selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.phone} · {detail.data?.ordersCount ?? selected?.ordersCount} commande(s) ·{" "}
              {mad(detail.data?.totalSpent ?? selected?.totalSpent ?? 0)}
            </DialogDescription>
          </DialogHeader>

          {detail.isPending && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          )}
          {detail.data && (
            <div className="space-y-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-y text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Commande</th>
                      <th className="py-2">Date</th>
                      <th className="py-2">Statut</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.data.orders.map((order) => (
                      <tr key={order.id}>
                        <td className="py-2 font-mono">{order.orderNumber}</td>
                        <td className="py-2 text-muted-foreground">{date(order.createdAt)}</td>
                        <td className="py-2">
                          <Badge variant="outline">{STATUS_LABELS[order.status]}</Badge>
                        </td>
                        <td className="py-2 text-right font-mono">{mad(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="text-sm font-semibold">Message WhatsApp</p>
                <Textarea
                  className="mt-2"
                  rows={4}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={`Bonjour ${detail.data.name.split(" ")[0] || detail.data.name}, …`}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={busy || !body.trim()}
                  onClick={() => {
                    if (detail.data) void prepareMessage(detail.data);
                  }}
                >
                  <MessageCircle /> Préparer sur WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WhatsAppModal draft={wa} onClose={() => setWa(null)} />
    </div>
  );
}
