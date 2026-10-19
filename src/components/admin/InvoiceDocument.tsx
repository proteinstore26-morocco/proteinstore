import type { InvoiceSummary, OrderDetail } from "@/lib/order-types";
import { PAYMENT_LABELS } from "@/lib/order-types";
import { mad } from "@/lib/pricing";

export function InvoiceDocument({
  invoice,
  order,
}: {
  invoice: InvoiceSummary;
  order: OrderDetail;
}) {
  return (
    <div className="invoice-print bg-white p-8 text-black">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-5">
        <div>
          <p className="text-2xl font-black uppercase tracking-tight">PROTEIN STORE®</p>
          <p className="mt-1 text-xs text-neutral-600">Kénitra, Maroc · +212 776 566 089</p>
          <p className="text-xs text-neutral-600">Paiement à la livraison (COD)</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase">Facture</p>
          <p className="font-mono text-lg">{invoice.number}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Émise le {new Date(invoice.issuedAt).toLocaleDateString("fr-MA")}
          </p>
          <p className="text-xs text-neutral-600">Commande {invoice.orderNumber}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">Client</p>
          <p className="mt-1 font-medium">{order.customerName}</p>
          <p>{order.customerPhone}</p>
          {order.customerEmail && <p>{order.customerEmail}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">Livraison</p>
          <p className="mt-1">{order.address}</p>
          <p>{order.city}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-y border-neutral-300 text-xs uppercase text-neutral-500">
          <tr>
            <th className="py-2">Article</th>
            <th className="py-2 text-center">Qté</th>
            <th className="py-2 text-right">Prix unitaire</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-2">
                {item.productTitle}
                {item.variant ? ` — ${item.variant}` : ""}
              </td>
              <td className="py-2 text-center">{item.quantity}</td>
              <td className="py-2 text-right font-mono">{mad(item.unitPrice)}</td>
              <td className="py-2 text-right font-mono">{mad(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 ml-auto w-full max-w-xs space-y-1 text-sm">
        <p className="flex justify-between">
          <span>Sous-total</span>
          <span className="font-mono">{mad(order.subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span>Livraison</span>
          <span className="font-mono">{order.shipping ? mad(order.shipping) : "Gratuite"}</span>
        </p>
        <p className="flex justify-between border-t border-neutral-300 pt-2 text-base font-bold">
          <span>Total</span>
          <span className="font-mono">{mad(order.total)}</span>
        </p>
        <p className="flex justify-between text-xs text-neutral-600">
          <span>Statut</span>
          <span>
            {invoice.status === "paid"
              ? "Payée"
              : invoice.status === "void"
                ? "Annulée"
                : PAYMENT_LABELS[order.paymentStatus]}
          </span>
        </p>
      </div>

      <p className="mt-8 border-t border-neutral-300 pt-4 text-xs text-neutral-600">
        Facture générée par PROTEIN STORE®. Paiement à la livraison — aucun paiement en ligne.
      </p>
    </div>
  );
}
