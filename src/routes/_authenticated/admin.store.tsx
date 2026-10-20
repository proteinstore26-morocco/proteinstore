import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Package,
  ShoppingBag,
  Users,
  ShieldCheck,
  Search,
  RefreshCw,
  Pencil,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  Lock,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminData,
  saveOrderAdmin,
  saveProductAdmin,
  savePartnerAdmin,
  listStaff,
  setStaff,
} from "@/lib/admin.functions";
import {
  canRevokeStaff,
  statusLabels,
  productEditSchema,
  partnerEditSchema,
  orderStatusSchema,
} from "@/lib/admin-rules";
import type { Tables } from "@/integrations/supabase/types";
import { mad } from "@/lib/pricing";
import { productImage } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EditorDialog,
  ProductFields,
  PartnerFields,
  OrderFields,
  SaveButton,
  Field,
  type AdminOrder,
} from "@/components/admin/Editors";

import { AdminUserMenu } from "@/components/admin/AdminUserMenu";

export const Route = createFileRoute("/_authenticated/admin/store")({
  head: () => ({
    meta: [
      { title: "Administration — PROTEIN STORE®" },
      {
        name: "description",
        content: "Gestion sécurisée des commandes, du catalogue et des partenaires Protein Store.",
      },
      { property: "og:title", content: "Administration — PROTEIN STORE®" },
      { property: "og:description", content: "Espace de gestion Protein Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});
const date = (s: string) =>
  new Date(s).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
const text = (f: FormData, key: string) => String(f.get(key) ?? "");
const statusTone = (s: string) =>
  s === "delivered"
    ? "text-success border-success/30"
    : s === "cancelled"
      ? "text-destructive border-destructive/30"
      : s === "pending"
        ? "text-warning border-warning/30"
        : "text-foreground";
function Admin() {
  const fetchData = useServerFn(getAdminData);
  const saveOrder = useServerFn(saveOrderAdmin);
  const saveProduct = useServerFn(saveProductAdmin);
  const savePartner = useServerFn(savePartnerAdmin);
  const fetchStaff = useServerFn(listStaff);
  const changeStaff = useServerFn(setStaff);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "store"],
    queryFn: () => fetchData({ data: undefined }),
    retry: false,
  });
  const staff = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => fetchStaff({ data: undefined }),
    enabled: false,
    retry: false,
  });
  const [tab, setTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<
    | { type: "order"; value: AdminOrder }
    | { type: "product"; value: Tables<"products"> }
    | { type: "partner"; value?: Tables<"partners"> }
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [revoking, setRevoking] = useState<{ email: string } | null>(null);
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (editing.type === "order")
        await saveOrder({
          data: {
            id: editing.value.id,
            status: orderStatusSchema.parse(text(f, "status")),
            admin_notes: text(f, "admin_notes"),
          },
        });
      if (editing.type === "product")
        await saveProduct({
          data: productEditSchema.parse({
            id: editing.value.id,
            image_urls: (() => {
              try {
                const parsed = JSON.parse(text(f, "image_urls") || "[]");
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })(),
            title: text(f, "title"),
            brand: text(f, "brand"),
            description: text(f, "description"),
            category_id: text(f, "category_id") === "none" ? null : text(f, "category_id"),
            price: Number(f.get("price")),
            sale_price: text(f, "sale_price") === "" ? null : Number(f.get("sale_price")),
            stock_quantity: Number(f.get("stock_quantity")),
            low_stock_threshold: Number(f.get("low_stock_threshold")),
            status: text(f, "status"),
            is_featured: f.get("is_featured") === "on",
            flavors: text(f, "flavors")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        });
      if (editing.type === "partner")
        await savePartner({
          data: partnerEditSchema.parse({
            id: editing.value?.id,
            ...Object.fromEntries(
              [
                "name",
                "location",
                "address",
                "description",
                "discount_code",
                "website_url",
                "instagram_url",
              ].map((k) => [k, text(f, k)]),
            ),
            is_active: f.get("is_active") === "on",
            display_order: Number(f.get("display_order")),
          }),
        });
      setEditing(null);
      toast.success("Modifications enregistrées.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function grant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await changeStaff({
        data: {
          email: text(f, "email"),
          password: text(f, "password") || undefined,
          action: "grant",
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStaffOpen(false);
      toast.success("Accès administrateur attribué.");
      await refresh();
    } catch {
      toast.error("Impossible d’attribuer l’accès.");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      const result = await changeStaff({ data: { email: revoking.email, action: "revoke" } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRevoking(null);
      toast.success("Accès administrateur retiré.");
      await refresh();
    } catch {
      toast.error("Impossible de retirer l’accès.");
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending)
    return (
      <main className="container-ps py-16" aria-busy="true">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="mt-4 text-muted-foreground">Chargement du magasin…</p>
      </main>
    );
  if (query.isError || !query.data)
    return (
      <main className="container-ps py-16">
        <ShieldCheck className="mb-4 size-10 text-primary" />
        <h1 className="text-3xl font-bold">Administration</h1>
        <p role="alert" className="my-6 text-muted-foreground">
          {query.error instanceof Error ? query.error.message : "Accès indisponible."}
        </p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Réessayer
        </Button>
        <Button asChild variant="ghost">
          <Link to="/account">Mon compte</Link>
        </Button>
      </main>
    );
  const data = query.data;
  const needle = search.trim().toLowerCase();
  const orders = data.orders.filter(
    (o) =>
      [o.order_number, o.customer_name, o.customer_phone].some((s) =>
        s.toLowerCase().includes(needle),
      ) &&
      (filter === "all" || o.status === filter),
  );
  const products = data.products.filter(
    (p) =>
      [p.title, p.brand ?? "", p.sku ?? ""].some((s) => s.toLowerCase().includes(needle)) &&
      (filter === "all" ||
        (filter === "low" ? p.stock_quantity <= p.low_stock_threshold : p.status === filter)),
  );
  const partners = data.partners.filter((p) =>
    [p.name, p.location ?? "", p.discount_code ?? ""].some((s) => s.toLowerCase().includes(needle)),
  );
  const stats = [
    {
      label: "Produits au catalogue",
      value: data.products.length,
      icon: Package,
      tone: "text-primary",
    },
    {
      label: "Produits publiés",
      value: data.products.filter((p) => p.status === "published").length,
      icon: ShieldCheck,
      tone: "text-success",
    },
    {
      label: "Stock faible",
      value: data.products.filter((p) => p.stock_quantity <= p.low_stock_threshold).length,
      icon: AlertTriangle,
      tone: "text-warning",
    },
    {
      label: "Partenaires actifs",
      value: data.partners.filter((p) => p.is_active).length,
      icon: Users,
      tone: "text-muted-foreground",
    },
  ];
  return (
    <main className="container-ps py-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ShieldCheck className="size-4" />
            {data.isSuperAdmin ? "Super Admin" : "Administrateur"}
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">Gestion du magasin</h1>
          <p className="mt-2 text-sm text-muted-foreground">PROTEIN STORE® · Kénitra</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin">Tableau de bord</Link>
          </Button>
          {data.isSuperAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/users">
                <ShieldCheck /> Utilisateurs
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/shop">
              Voir la boutique
              <ArrowUpRight />
            </Link>
          </Button>
          <AdminUserMenu />
        </div>
      </header>
      <div className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 md:p-5">
            <s.icon className={`mb-5 size-5 ${s.tone}`} />
            <p className="break-words font-mono text-2xl font-semibold">{s.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setSearch("");
          setFilter("all");
        }}
      >
        <div className="overflow-x-auto border-b pb-3">
          <TabsList className="h-auto bg-transparent p-0">
            {[
              { value: "orders", label: "Commandes", icon: ShoppingBag },
              { value: "products", label: "Produits", icon: Package },
              { value: "partners", label: "Partenaires", icon: Users },
            ].map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 px-4 py-3">
                <t.icon className="size-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="my-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-52">
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="ps-9"
              aria-label="Rechercher dans l’administration"
              placeholder={
                tab === "orders"
                  ? "N° commande, client, téléphone…"
                  : tab === "products"
                    ? "Produit, marque, référence…"
                    : "Rechercher…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(tab === "orders" || tab === "products") && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44" aria-label="Filtrer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {tab === "orders" ? (
                  orderStatusSchema.options.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="published">Publiés</SelectItem>
                    <SelectItem value="draft">Brouillons</SelectItem>
                    <SelectItem value="low">Stock faible</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="icon"
            title="Actualiser"
            aria-label="Actualiser"
            disabled={query.isFetching}
            onClick={refresh}
          >
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
          </Button>
          {tab === "partners" && (
            <Button onClick={() => setEditing({ type: "partner" })}>
              <Plus />
              Ajouter une salle
            </Button>
          )}
          {tab === "staff" && (
            <Button onClick={() => setStaffOpen(true)}>
              <Plus />
              Ajouter un admin
            </Button>
          )}
        </div>
        <TabsContent value="orders">
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Les commandes, clients et factures sont gérés dans le tableau de bord.
            </p>
            <Button asChild className="mt-4">
              <Link to="/admin">Ouvrir le tableau de bord</Link>
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="products">
          <p className="mb-4 text-xs text-muted-foreground">{products.length} produits</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-y text-xs uppercase text-muted-foreground">
                <tr>
                  {["Produit", "Prix", "Stock", "Publication", ""].map((h, i) => (
                    <th key={i} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={productImage({
                            ...p,
                            category: data.categories.find((c) => c.id === p.category_id) ?? null,
                          })}
                          alt=""
                          className="size-12 shrink-0 rounded-md object-cover"
                        />
                        <div>
                          <p className="max-w-80 font-medium">{p.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {p.brand} · {p.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono">{mad(p.sale_price ?? p.price)}</td>
                    <td
                      className={`px-3 py-3 font-mono ${p.stock_quantity <= p.low_stock_threshold ? "text-warning" : "text-success"}`}
                    >
                      {p.stock_quantity}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">
                        {p.status === "published" ? "Publié" : "Brouillon"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Modifier le produit"
                        aria-label={`Modifier ${p.title}`}
                        onClick={() => setEditing({ type: "product", value: p })}
                      >
                        <Pencil />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length === 0 && <Empty label="Aucun produit trouvé" />}
        </TabsContent>
        <TabsContent value="partners">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <article key={p.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{p.location}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Modifier le partenaire"
                    aria-label={`Modifier ${p.name}`}
                    onClick={() => setEditing({ type: "partner", value: p })}
                  >
                    <Pencil />
                  </Button>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <code className="text-sm text-primary">{p.discount_code || "—"}</code>
                  <Badge
                    variant="outline"
                    className={p.is_active ? "text-success" : "text-muted-foreground"}
                  >
                    {p.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
          {partners.length === 0 && <Empty label="Aucun partenaire trouvé" />}
        </TabsContent>
        {data.isSuperAdmin && (
          <TabsContent value="staff">
            {staff.isPending ? (
              <Empty label="Chargement des accès…" />
            ) : staff.isError ? (
              <div role="alert">
                <p>Impossible de charger les accès.</p>
                <Button variant="outline" onClick={() => staff.refetch()}>
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="divide-y border-y">
                {staff.data
                  ?.filter((s) => s.email.toLowerCase().includes(needle))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-5"
                    >
                      <div>
                        <p className="break-all font-medium">{s.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.roles.includes("super_admin") ? "Super Admin" : "Administrateur"}
                          {s.id === data.userId ? " · Vous" : ""}
                        </p>
                      </div>
                      {canRevokeStaff(data.userId, s.id, s.roles) ? (
                        <Button variant="outline" onClick={() => setRevoking(s)}>
                          <UserMinus />
                          Retirer l’accès
                        </Button>
                      ) : (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Lock className="size-3" />
                          Protégé
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
      {editing && (
        <EditorDialog
          title={
            editing.type === "order"
              ? `Commande ${editing.value.order_number}`
              : editing.type === "product"
                ? "Modifier le produit"
                : editing.value
                  ? "Modifier le partenaire"
                  : "Ajouter un partenaire"
          }
          subtitle={
            editing.type === "product"
              ? (editing.value.sku ?? "Catalogue")
              : editing.type === "order"
                ? date(editing.value.created_at)
                : "Salles partenaires"
          }
          close={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-6">
            {editing.type === "order" ? (
              <OrderFields order={editing.value} />
            ) : editing.type === "product" ? (
              <ProductFields product={editing.value} categories={data.categories} />
            ) : (
              <PartnerFields partner={editing.value} />
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Annuler
              </Button>
              <SaveButton busy={busy} />
            </div>
          </form>
        </EditorDialog>
      )}
      {staffOpen && (
        <EditorDialog
          title="Ajouter un administrateur"
          subtitle="Accès à la gestion du magasin"
          close={() => {
            if (!busy) setStaffOpen(false);
          }}
        >
          <form onSubmit={grant} className="space-y-5">
            <Field label="Identifiant ou e-mail">
              <Input name="email" required />
            </Field>
            <Field label="Mot de passe (nouveau compte uniquement)">
              <Input name="password" type="password" minLength={8} autoComplete="new-password" />
            </Field>
            <div className="flex justify-end">
              <SaveButton busy={busy} />
            </div>
          </form>
        </EditorDialog>
      )}
      {revoking && (
        <EditorDialog
          title="Retirer l’accès administrateur ?"
          subtitle={revoking.email}
          close={() => {
            if (!busy) setRevoking(null);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Ce compte conserve son accès client, mais ne pourra plus gérer le magasin.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setRevoking(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={busy} onClick={revoke}>
              Retirer l’accès
            </Button>
          </div>
        </EditorDialog>
      )}
    </main>
  );
}
function Empty({ label }: { label: string }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{label}</p>;
}
