// Shared order types (safe for client imports — no server-only dependencies).

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const INVOICE_STATUSES = ["issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Non payée",
  paid: "Payée",
  refunded: "Remboursée",
};

export type OrderItem = {
  id: string;
  orderId: string;
  productSlug: string;
  productTitle: string;
  variant: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerPhoneNorm: string;
  customerEmail: string | null;
  city: string;
  address: string;
  notes: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  id: number;
  orderId: string;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  orderId: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  notes: string | null;
};

export type InvoiceSummary = Invoice & {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  orderStatus: OrderStatus;
};

export type WhatsAppLogEntry = {
  id: number;
  phone: string;
  orderId: string | null;
  template: string;
  body: string;
  createdAt: string;
  sentBy: string | null;
};

export type OrderSummary = Order & { itemCount: number; invoiceNumber: string | null };

export type OrderDetail = Order & {
  items: OrderItem[];
  events: OrderEvent[];
  invoice: Invoice | null;
  messages: WhatsAppLogEntry[];
};

export type PublicOrder = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
  items: { title: string; variant: string | null; quantity: number; lineTotal: number }[];
  timeline: { type: string; message: string; createdAt: string }[];
  invoiceNumber: string | null;
};

export type CustomerSummary = {
  phoneNorm: string;
  phone: string;
  name: string;
  email: string | null;
  city: string;
  ordersCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

export type CustomerDetail = CustomerSummary & { orders: OrderSummary[] };

export type StoreStats = {
  ordersCount: number;
  pendingCount: number;
  revenue: number;
  deliveredRevenue: number;
  customersCount: number;
  averageOrder: number;
  statusCounts: Record<OrderStatus, number>;
  topProducts: { title: string; quantity: number; revenue: number }[];
};

export type ProductSeoIssue = {
  id: string;
  title: string;
  slug: string;
  status: string;
  score: number;
  issues: string[];
};

export type SeoAudit = {
  baseUrl: string;
  score: number;
  productCount: number;
  publishedCount: number;
  averageProductScore: number;
  products: ProductSeoIssue[];
  duplicates: string[];
  site: { path: string; title: string; description: string; ok: boolean; note: string }[];
  sitemapReady: boolean;
  checkedAt: string;
};
