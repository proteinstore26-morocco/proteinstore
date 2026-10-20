import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  FileText,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { getAdminOrders, getAdminStats } from "@/lib/store.functions";
import { useAuth } from "@/lib/auth";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-types";
import { mad } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomersPanel } from "@/components/admin/CustomersPanel";
import { InvoicesPanel } from "@/components/admin/InvoicesPanel";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { SeoPanel } from "@/components/admin/SeoPanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — PROTEIN STORE®" },
      { name: "description", content: "Commandes, clients, factures et SEO Protein Store." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

const statusTone = (status: OrderStatus) =>
  status === "delivered"
    ? "text-success border-success/30"
    : status === "cancelled"
      ? "text-destructive border-destructive/30"
      : status === "pending"
        ? "text-warning border-warning/30"
        : "text-foreground";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

function AdminDashboard() {
  const statsFn = useServerFn(getAdminStats);
  const ordersFn = useServerFn(getAdminOrders);
  const [tab, setTab] = useState("overview");
  const { isAdmin, isRoot, isManager, isSuspended, loading: authLoading } = useAuth();

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => statsFn({ data: undefined }),
    retry: false,
    enabled: isManager,
  });
  const orders = useQuery({
    queryKey: ["admin", "orders", "overview"],
    queryFn: () => ordersFn({ data: undefined }),
    retry: false,
    enabled: isManager,
  });

  if (authLoading || (isManager && stats.isPending)) {
    return (
      <main className="container-ps py-16" aria-busy="true">
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="mt-4 text-muted-foreground">Chargement du magasin…</p>
      </main>
    );
  }

  if (!isManager) {
    return (
      <main className="container-ps py-16">
        <ShieldCheck className="mb-4 size-10 text-primary" />
        <h1 className="text-3xl font-bold">Administration</h1>
        <p role="alert" className="my-6 text-muted-foreground">
          {isSuspended
            ? "Votre compte est suspendu. Contactez un super admin."
            : "Accès réservé aux responsables boutique, administrateurs et super admins."}
        </p>
        <Button asChild>
          <Link to="/auth">Changer de compte</Link>
        </Button>
      </main>
    );
  }

  if (stats.isError || !stats.data) {
    return (
      <main className="container-ps py-16">
        <ShieldCheck className="mb-4 size-10 text-primary" />
        <h1 className="text-3xl font-bold">Administration</h1>
        <p role="alert" className="my-6 text-muted-foreground">
          {stats.error instanceof Error ? stats.error.message : "Accès indisponible."}
        </p>
        <Button asChild>
          <Link to="/auth">Se connecter</Link>
        </Button>
      </main>
    );
  }

  const data = stats.data;
  const recent = (orders.data ?? []).slice(0, 6);

  return (
    <main className="container-ps py-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ShieldCheck className="size-4" /> Administration
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">Tableau de bord</h1>
          <p className="mt-2 text-sm text-muted-foreground">PROTEIN STORE® · Kénitra</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isRoot && (
            <Button asChild variant="outline">
              <Link to="/admin/users">
                <Users /> Utilisateurs
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/store">
                <Package /> Catalogue & partenaires
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/import">
                <Download /> Importer
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/catalogue">
                <FileSpreadsheet /> Catalogue CSV
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/shop">
              Voir la boutique <ArrowUpRight />
            </Link>
          </Button>
          <AdminUserMenu />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <div className="overflow-x-auto border-b pb-3">
          <TabsList className="h-auto bg-transparent p-0">
            <TabsTrigger value="overview" className="gap-2 px-4 py-3">
              <LayoutDashboard className="size-4" /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 px-4 py-3">
              <ShoppingBag className="size-4" /> Commandes
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2 px-4 py-3">
              <Users className="size-4" /> Clients
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 px-4 py-3">
              <FileText className="size-4" /> Factures
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="seo" className="gap-2 px-4 py-3">
                <Search className="size-4" /> SEO
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6">
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Chiffre d'affaires",
                value: mad(data.revenue),
                icon: ArrowUpRight,
                tone: "text-success",
              },
              {
                label: "Commandes",
                value: String(data.ordersCount),
                icon: ShoppingBag,
                tone: "text-primary",
              },
              {
                label: "Clients",
                value: String(data.customersCount),
                icon: Users,
                tone: "text-foreground",
              },
              {
                label: "Panier moyen",
                value: mad(data.averageOrder),
                icon: FileText,
                tone: "text-muted-foreground",
              },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border bg-card p-4 md:p-5">
                <card.icon className={`mb-5 size-5 ${card.tone}`} />
                <p className="break-words font-mono text-2xl font-semibold">{card.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{card.label}</p>
              </div>
            ))}
          </section>

          {data.pendingCount > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <p className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-warning" />
                {data.pendingCount} commande(s) en attente de confirmation.
              </p>
              <Button size="sm" onClick={() => setTab("orders")}>
                Traiter maintenant
              </Button>
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Dernières commandes
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setTab("orders")}>
                  Tout voir
                </Button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-y text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Commande</th>
                      <th className="px-3 py-2 font-medium">Client</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recent.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-3 font-mono">{order.orderNumber}</td>
                        <td className="px-3 py-3">
                          {order.customerName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {date(order.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono">{mad(order.total)}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={statusTone(order.status)}>
                            {STATUS_LABELS[order.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recent.length === 0 && (
                <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucune commande encore. Le checkout enregistre la première automatiquement.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top produits
              </h2>
              <ul className="mt-3 space-y-3">
                {data.topProducts.map((product, index) => (
                  <li
                    key={product.title}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3"
                  >
                    <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantity} vendu(s) · {mad(product.revenue)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {data.topProducts.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Pas encore de ventes.</p>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrdersPanel />
        </TabsContent>
        <TabsContent value="customers" className="mt-6">
          <CustomersPanel />
        </TabsContent>
        <TabsContent value="invoices" className="mt-6">
          <InvoicesPanel />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="seo" className="mt-6">
            <SeoPanel />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}
