import type { ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Save } from "lucide-react";
import { statusLabels, orderStatusSchema } from "@/lib/admin-rules";
import { mad } from "@/lib/pricing";

export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
export function Choice({ label, name, value, options }: { label: string; name: string; value: string; options: { value: string; label: string }[] }) {
  return <Field label={label}><Select name={name} defaultValue={value}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field>;
}
export function EditorDialog({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: ReactNode }) {
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{subtitle}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
export function SaveButton({ busy }: { busy: boolean }) { return <Button type="submit" disabled={busy}><Save />{busy ? "Enregistrement…" : "Enregistrer"}</Button>; }
export function ProductFields({ product, categories }: { product: Tables<"products">; categories: Tables<"categories">[] }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <Field label="Nom du produit"><Input name="title" defaultValue={product.title} required maxLength={200} /></Field>
    <Field label="Marque"><Input name="brand" defaultValue={product.brand ?? ""} /></Field>
    <Choice label="Catégorie" name="category_id" value={product.category_id ?? "none"} options={[{ value: "none", label: "Sans catégorie" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
    <Choice label="Publication" name="status" value={product.status === "published" ? "published" : "draft"} options={[{ value: "published", label: "Publié" }, { value: "draft", label: "Brouillon" }]} />
    <Field label="Prix (MAD)"><Input name="price" type="number" min={0} step={1} defaultValue={product.price} required /></Field>
    <Field label="Prix promotionnel (MAD)"><Input name="sale_price" type="number" min={0} step={1} defaultValue={product.sale_price ?? ""} /></Field>
    <Field label="Stock"><Input name="stock_quantity" type="number" min={0} step={1} defaultValue={product.stock_quantity} required /></Field>
    <Field label="Seuil d’alerte stock"><Input name="low_stock_threshold" type="number" min={0} step={1} defaultValue={product.low_stock_threshold} required /></Field>
    <div className="sm:col-span-2"><Field label="Saveurs (séparées par des virgules)"><Input name="flavors" defaultValue={product.flavors.join(", ")} /></Field></div>
    <div className="sm:col-span-2"><Field label="Description"><Textarea name="description" rows={5} defaultValue={product.description ?? ""} /></Field></div>
    <div className="flex items-center gap-2"><Checkbox id="featured" name="is_featured" defaultChecked={product.is_featured} /><Label htmlFor="featured">Produit mis en avant</Label></div>
  </div>;
}
export function PartnerFields({ partner }: { partner?: Tables<"partners"> | undefined }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <Field label="Nom de la salle"><Input name="name" required defaultValue={partner?.name ?? ""} /></Field>
    <Field label="Ville"><Input name="location" defaultValue={partner?.location ?? ""} /></Field>
    <Field label="Code partenaire"><Input name="discount_code" defaultValue={partner?.discount_code ?? ""} /></Field>
    <Field label="Ordre d’affichage"><Input type="number" min={0} step={1} name="display_order" defaultValue={partner?.display_order ?? 0} required /></Field>
    <div className="sm:col-span-2"><Field label="Adresse"><Input name="address" defaultValue={partner?.address ?? ""} /></Field></div>
    <Field label="Site web"><Input type="url" name="website_url" defaultValue={partner?.website_url ?? ""} placeholder="https://" /></Field>
    <Field label="Instagram"><Input type="url" name="instagram_url" defaultValue={partner?.instagram_url ?? ""} placeholder="https://" /></Field>
    <div className="sm:col-span-2"><Field label="Description"><Textarea rows={3} name="description" defaultValue={partner?.description ?? ""} /></Field></div>
    <div className="flex items-center gap-2"><Checkbox id="active" name="is_active" defaultChecked={partner?.is_active ?? true} /><Label htmlFor="active">Partenaire actif</Label></div>
  </div>;
}
export type AdminOrder = Tables<"orders"> & { order_items: Tables<"order_items">[] };
export function OrderFields({ order }: { order: AdminOrder }) {
  const address = order.shipping_address && typeof order.shipping_address === "object" && !Array.isArray(order.shipping_address) ? order.shipping_address : {};
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><div><p className="font-semibold">{order.customer_name}</p><a className="text-primary" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a><a className="mt-1 block text-sm text-success hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/212${order.customer_phone.replace(/\D/g, "").slice(-9)}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, Protein Store confirme votre commande ${order.order_number} (${mad(order.total)}, paiement à la livraison).`)}`}>Confirmer sur WhatsApp</a><p className="break-all text-sm text-muted-foreground">{order.customer_email}</p></div><div className="text-sm"><p>{String(address["address"] ?? "")}</p><p>{String(address["city"] ?? "")} {String(address["postal"] ?? "")}</p><p className="mt-2 text-muted-foreground">Paiement à la livraison</p></div></div>
    <div className="divide-y border-y">{order.order_items.map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.quantity} × {item.product_title}<small className="block text-muted-foreground">{item.variant_name}</small></span><span className="shrink-0 font-mono">{mad(item.quantity * item.price_at_purchase)}</span></div>)}</div>
    <div className="space-y-1 text-sm"><p className="flex justify-between"><span>Sous-total</span><span>{mad(order.subtotal)}</span></p><p className="flex justify-between"><span>Livraison</span><span>{mad(order.shipping_cost)}</span></p><p className="flex justify-between font-semibold"><span>Total</span><span>{mad(order.total)}</span></p></div>
    {order.notes && <p className="text-sm text-muted-foreground">Note client : {order.notes}</p>}
    <Choice label="Statut" name="status" value={order.status} options={orderStatusSchema.options.map((s) => ({ value: s, label: statusLabels[s] }))} />
    <Field label="Notes internes"><Textarea name="admin_notes" rows={3} defaultValue={order.admin_notes ?? ""} /></Field>
  </div>;
}
