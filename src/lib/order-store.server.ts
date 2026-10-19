// Local order store (Node's built-in SQLite). Deliberately independent from the
// Supabase backend: orders, invoices and tracking work without a service-role key.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { samePhone } from "./phone";
import type {
  CustomerDetail,
  CustomerSummary,
  Invoice,
  InvoiceStatus,
  InvoiceSummary,
  Order,
  OrderDetail,
  OrderEvent,
  OrderItem,
  OrderStatus,
  OrderSummary,
  PaymentStatus,
  PublicOrder,
  StoreStats,
  WhatsAppLogEntry,
} from "./order-types";
import { INVOICE_STATUSES, ORDER_STATUSES, PAYMENT_STATUSES } from "./order-types";

type SqlValue = string | number | null;
type Row = Record<string, unknown>;

const now = () => new Date().toISOString();

function dbPath(): string {
  return process.env["ORDER_DB_PATH"] ?? join(process.cwd(), "data", "proteinstore.db");
}

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : Number(value ?? fallback);
const asNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

function mapOrder(row: Row): Order {
  return {
    id: asString(row["id"]),
    orderNumber: asString(row["order_number"]),
    customerName: asString(row["customer_name"]),
    customerPhone: asString(row["customer_phone"]),
    customerPhoneNorm: asString(row["customer_phone_norm"]),
    customerEmail: asNullableString(row["customer_email"]),
    city: asString(row["city"]),
    address: asString(row["address"]),
    notes: asNullableString(row["notes"]),
    subtotal: asNumber(row["subtotal"]),
    shipping: asNumber(row["shipping"]),
    total: asNumber(row["total"]),
    status: asString(row["status"], "pending") as OrderStatus,
    paymentStatus: asString(row["payment_status"], "unpaid") as PaymentStatus,
    createdAt: asString(row["created_at"]),
    updatedAt: asString(row["updated_at"]),
  };
}

function mapItem(row: Row): OrderItem {
  return {
    id: asString(row["id"]),
    orderId: asString(row["order_id"]),
    productSlug: asString(row["product_slug"]),
    productTitle: asString(row["product_title"]),
    variant: asNullableString(row["variant"]),
    quantity: asNumber(row["quantity"]),
    unitPrice: asNumber(row["unit_price"]),
    lineTotal: asNumber(row["line_total"]),
  };
}

function mapEvent(row: Row): OrderEvent {
  return {
    id: asNumber(row["id"]),
    orderId: asString(row["order_id"]),
    type: asString(row["type"]),
    message: asString(row["message"]),
    actor: asString(row["actor"], "system"),
    createdAt: asString(row["created_at"]),
  };
}

function mapInvoice(row: Row): Invoice {
  return {
    id: asString(row["id"]),
    number: asString(row["number"]),
    orderId: asString(row["order_id"]),
    status: asString(row["status"], "issued") as InvoiceStatus,
    issuedAt: asString(row["issued_at"]),
    paidAt: asNullableString(row["paid_at"]),
    notes: asNullableString(row["notes"]),
  };
}

function mapMessage(row: Row): WhatsAppLogEntry {
  return {
    id: asNumber(row["id"]),
    phone: asString(row["phone"]),
    orderId: asNullableString(row["order_id"]),
    template: asString(row["template"]),
    body: asString(row["body"]),
    createdAt: asString(row["created_at"]),
    sentBy: asNullableString(row["sent_by"]),
  };
}

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  customerPhoneNorm: string;
  customerEmail?: string | null;
  city: string;
  address: string;
  notes?: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  items: {
    productSlug: string;
    productTitle: string;
    variant?: string | null;
    quantity: number;
    unitPrice: number;
  }[];
};

export class OrderStore {
  private readonly db: DatabaseSync;

  constructor(path = dbPath()) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try {
      this.db.exec("PRAGMA journal_mode = WAL");
    } catch {
      // WAL is unavailable for in-memory databases; the default journal is fine.
    }
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_phone_norm TEXT NOT NULL,
        customer_email TEXT,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        notes TEXT,
        subtotal INTEGER NOT NULL,
        shipping INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (customer_phone_norm);
      CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_slug TEXT NOT NULL,
        product_title TEXT NOT NULL,
        variant TEXT,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        line_total INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, id);

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'issued',
        issued_at TEXT NOT NULL,
        paid_at TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        template TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sent_by TEXT
      );
      CREATE INDEX IF NOT EXISTS whatsapp_order_idx ON whatsapp_messages (order_id, id);

      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );
    `);
  }

  private nextSequence(name: string): number {
    const row = this.db
      .prepare(
        "INSERT INTO counters(name,value) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET value=value+1 RETURNING value",
      )
      .get(name) as Row | undefined;
    return asNumber(row?.["value"], 1);
  }

  private numberFromSequence(prefix: "PS" | "FAC", sequence: number): string {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(sequence).padStart(5, "0")}`;
  }

  createOrder(input: CreateOrderInput): OrderDetail {
    const id = randomUUID();
    const at = now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const orderNumber = this.numberFromSequence("PS", this.nextSequence("order"));
      this.db
        .prepare(
          `INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_phone_norm,
            customer_email, city, address, notes, subtotal, shipping, total, status, payment_status,
            created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          orderNumber,
          input.customerName,
          input.customerPhone,
          input.customerPhoneNorm,
          input.customerEmail ?? null,
          input.city,
          input.address,
          input.notes ?? null,
          input.subtotal,
          input.shipping,
          input.total,
          "pending",
          "unpaid",
          at,
          at,
        );

      const insertItem = this.db.prepare(
        `INSERT INTO order_items (id, order_id, product_slug, product_title, variant, quantity, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?,?)`,
      );
      for (const item of input.items) {
        insertItem.run(
          randomUUID(),
          id,
          item.productSlug,
          item.productTitle,
          item.variant ?? null,
          item.quantity,
          item.unitPrice,
          item.quantity * item.unitPrice,
        );
      }

      this.insertEvent(
        id,
        "created",
        `Commande créée (${input.items.length} article(s))`,
        "system",
        at,
      );
      this.db.exec("COMMIT");
      const created = this.getOrder(id);
      if (!created) throw new Error("Order was not persisted");
      return created;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private insertEvent(
    orderId: string,
    type: string,
    message: string,
    actor: string,
    at = now(),
  ): void {
    this.db
      .prepare(
        "INSERT INTO order_events (order_id, type, message, actor, created_at) VALUES (?,?,?,?,?)",
      )
      .run(orderId, type, message, actor, at);
  }

  getOrder(id: string): OrderDetail | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Row | undefined;
    if (!row) return null;
    const order = mapOrder(row);
    const items = (
      this.db
        .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid")
        .all(id) as Row[]
    ).map(mapItem);
    const events = (
      this.db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").all(id) as Row[]
    ).map(mapEvent);
    const invoiceRow = this.db.prepare("SELECT * FROM invoices WHERE order_id = ?").get(id) as
      Row | undefined;
    const messages = (
      this.db
        .prepare("SELECT * FROM whatsapp_messages WHERE order_id = ? ORDER BY id DESC LIMIT 50")
        .all(id) as Row[]
    ).map(mapMessage);
    return {
      ...order,
      items,
      events,
      invoice: invoiceRow ? mapInvoice(invoiceRow) : null,
      messages,
    };
  }

  findByNumber(orderNumber: string): OrderDetail | null {
    const row = this.db
      .prepare("SELECT id FROM orders WHERE order_number = ?")
      .get(orderNumber.toUpperCase()) as Row | undefined;
    return row ? this.getOrder(asString(row["id"])) : null;
  }

  tracking(orderNumber: string, phone: string): PublicOrder | null {
    const order = this.findByNumber(orderNumber);
    if (!order || !samePhone(order.customerPhoneNorm, phone)) return null;
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        title: item.productTitle,
        variant: item.variant,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      timeline: order.events
        .filter((event) => ["created", "status", "invoice", "payment"].includes(event.type))
        .map((event) => ({ type: event.type, message: event.message, createdAt: event.createdAt })),
      invoiceNumber: order.invoice?.number ?? null,
    };
  }

  listOrders(
    options: { status?: OrderStatus | "all"; q?: string; limit?: number } = {},
  ): OrderSummary[] {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.status && options.status !== "all") {
      where.push("o.status = ?");
      params.push(options.status);
    }
    const query = options.q?.trim();
    if (query) {
      where.push(
        "(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone_norm LIKE ?)",
      );
      const like = `%${query}%`;
      params.push(like, like, like);
    }
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
    params.push(limit);
    const sql = `SELECT o.*,
        (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count,
        (SELECT number FROM invoices v WHERE v.order_id = o.id) AS invoice_number
      FROM orders o
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.created_at DESC
      LIMIT ?`;
    return (this.db.prepare(sql).all(...params) as Row[]).map((row) => ({
      ...mapOrder(row),
      itemCount: asNumber(row["item_count"]),
      invoiceNumber: asNullableString(row["invoice_number"]),
    }));
  }

  updateStatus(id: string, status: OrderStatus, actor: string): OrderDetail {
    if (!ORDER_STATUSES.includes(status)) throw new Error("Statut invalide.");
    const before = this.getOrder(id);
    if (!before) throw new Error("Commande introuvable.");
    if (before.status === status) return before;
    const at = now();
    const payment: PaymentStatus = status === "delivered" ? "paid" : before.paymentStatus;
    this.db
      .prepare("UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?")
      .run(status, payment, at, id);
    this.insertEvent(
      id,
      "status",
      `Statut : ${before.status} → ${status}${payment !== before.paymentStatus ? " (paiement encaissé)" : ""}`,
      actor,
      at,
    );
    const after = this.getOrder(id);
    if (!after) throw new Error("Commande introuvable.");
    return after;
  }

  addNote(id: string, note: string, actor: string): OrderDetail {
    const order = this.getOrder(id);
    if (!order) throw new Error("Commande introuvable.");
    this.insertEvent(id, "note", note.slice(0, 2000), actor);
    return this.getOrder(id) ?? order;
  }

  listCustomers(query = ""): CustomerSummary[] {
    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT o.customer_phone_norm AS phoneNorm,
             (SELECT customer_phone FROM orders x WHERE x.customer_phone_norm = o.customer_phone_norm ORDER BY x.created_at DESC LIMIT 1) AS phone,
             (SELECT customer_name FROM orders x WHERE x.customer_phone_norm = o.customer_phone_norm ORDER BY x.created_at DESC LIMIT 1) AS name,
             (SELECT customer_email FROM orders x WHERE x.customer_phone_norm = o.customer_phone_norm ORDER BY x.created_at DESC LIMIT 1) AS email,
             (SELECT city FROM orders x WHERE x.customer_phone_norm = o.customer_phone_norm ORDER BY x.created_at DESC LIMIT 1) AS city,
             COUNT(*) AS ordersCount,
             SUM(o.total) AS totalSpent,
             MIN(o.created_at) AS firstOrderAt,
             MAX(o.created_at) AS lastOrderAt
           FROM orders o GROUP BY o.customer_phone_norm
         ) WHERE (? = '%%' OR name LIKE ? OR phoneNorm LIKE ?)
         ORDER BY lastOrderAt DESC
         LIMIT 300`,
      )
      .all(like, like, like) as Row[];
    return rows.map((row) => ({
      phoneNorm: asString(row["phoneNorm"]),
      phone: asString(row["phone"]),
      name: asString(row["name"]),
      email: asNullableString(row["email"]),
      city: asString(row["city"]),
      ordersCount: asNumber(row["ordersCount"]),
      totalSpent: asNumber(row["totalSpent"]),
      firstOrderAt: asString(row["firstOrderAt"]),
      lastOrderAt: asString(row["lastOrderAt"]),
    }));
  }

  getCustomer(phoneNorm: string): CustomerDetail | null {
    const summary = this.listCustomers("").find((customer) => customer.phoneNorm === phoneNorm);
    if (!summary) return null;
    const orders = this.listOrders({ q: summary.phoneNorm, limit: 500 });
    return { ...summary, orders };
  }

  listInvoices(): InvoiceSummary[] {
    const rows = this.db
      .prepare(
        `SELECT v.*, o.order_number AS order_number, o.customer_name AS customer_name,
                o.customer_phone AS customer_phone, o.total AS order_total, o.status AS order_status
         FROM invoices v JOIN orders o ON o.id = v.order_id
         ORDER BY v.issued_at DESC LIMIT 500`,
      )
      .all() as Row[];
    return rows.map((row) => ({
      ...mapInvoice(row),
      orderNumber: asString(row["order_number"]),
      customerName: asString(row["customer_name"]),
      customerPhone: asString(row["customer_phone"]),
      total: asNumber(row["order_total"]),
      orderStatus: asString(row["order_status"], "pending") as OrderStatus,
    }));
  }

  createInvoice(orderId: string, actor: string): InvoiceSummary {
    const order = this.getOrder(orderId);
    if (!order) throw new Error("Commande introuvable.");
    if (order.invoice) {
      const existing = this.listInvoices().find((invoice) => invoice.id === order.invoice?.id);
      if (existing) return existing;
    }
    const at = now();
    const id = randomUUID();
    const number = this.numberFromSequence("FAC", this.nextSequence("invoice"));
    this.db
      .prepare("INSERT INTO invoices (id, number, order_id, status, issued_at) VALUES (?,?,?,?,?)")
      .run(id, number, orderId, "issued", at);
    this.insertEvent(orderId, "invoice", `Facture ${number} générée`, actor, at);
    const created = this.listInvoices().find((invoice) => invoice.id === id);
    if (!created) throw new Error("Facture non enregistrée.");
    return created;
  }

  setInvoiceStatus(invoiceId: string, status: InvoiceStatus, actor: string): InvoiceSummary {
    if (!INVOICE_STATUSES.includes(status)) throw new Error("Statut de facture invalide.");
    const row = this.db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId) as
      Row | undefined;
    if (!row) throw new Error("Facture introuvable.");
    const invoice = mapInvoice(row);
    const at = now();
    this.db
      .prepare("UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?")
      .run(status, status === "paid" ? at : invoice.paidAt, invoiceId);
    if (status === "paid") {
      this.db
        .prepare("UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ?")
        .run(at, invoice.orderId);
      this.insertEvent(
        invoice.orderId,
        "payment",
        `Facture ${invoice.number} marquée payée`,
        actor,
        at,
      );
    } else if (status === "void") {
      this.insertEvent(invoice.orderId, "invoice", `Facture ${invoice.number} annulée`, actor, at);
    }
    const updated = this.listInvoices().find((entry) => entry.id === invoiceId);
    if (!updated) throw new Error("Facture introuvable.");
    return updated;
  }

  recordWhatsApp(input: {
    phone: string;
    orderId?: string | null;
    template: string;
    body: string;
    sentBy?: string | null;
  }): WhatsAppLogEntry {
    const at = now();
    const result = this.db
      .prepare(
        "INSERT INTO whatsapp_messages (phone, order_id, template, body, created_at, sent_by) VALUES (?,?,?,?,?,?)",
      )
      .run(
        input.phone,
        input.orderId ?? null,
        input.template,
        input.body.slice(0, 4000),
        at,
        input.sentBy ?? null,
      );
    if (input.orderId) {
      this.insertEvent(
        input.orderId,
        "whatsapp",
        `Message WhatsApp (${input.template})`,
        input.sentBy ?? "system",
        at,
      );
    }
    const row = this.db
      .prepare("SELECT * FROM whatsapp_messages WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as Row | undefined;
    return row
      ? mapMessage(row)
      : {
          id: 0,
          phone: input.phone,
          orderId: input.orderId ?? null,
          template: input.template,
          body: input.body,
          createdAt: at,
          sentBy: input.sentBy ?? null,
        };
  }

  stats(): StoreStats {
    const rows = this.db
      .prepare("SELECT status, COUNT(*) AS count, SUM(total) AS sum FROM orders GROUP BY status")
      .all() as Row[];
    const statusCounts: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    let ordersCount = 0;
    let revenue = 0;
    let deliveredRevenue = 0;
    for (const row of rows) {
      const status = asString(row["status"], "pending") as OrderStatus;
      const count = asNumber(row["count"]);
      const sum = asNumber(row["sum"]);
      if (status in statusCounts) statusCounts[status] = count;
      ordersCount += count;
      if (status !== "cancelled") revenue += sum;
      if (status === "delivered") deliveredRevenue += sum;
    }
    const customerRow = this.db
      .prepare("SELECT COUNT(DISTINCT customer_phone_norm) AS count FROM orders")
      .get() as Row | undefined;
    const topRows = this.db
      .prepare(
        `SELECT i.product_title AS title, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.status != 'cancelled'
         GROUP BY i.product_title ORDER BY quantity DESC LIMIT 5`,
      )
      .all() as Row[];
    return {
      ordersCount,
      pendingCount: statusCounts.pending,
      revenue,
      deliveredRevenue,
      customersCount: asNumber(customerRow?.["count"]),
      averageOrder: ordersCount ? Math.round(revenue / ordersCount) : 0,
      statusCounts,
      topProducts: topRows.map((row) => ({
        title: asString(row["title"]),
        quantity: asNumber(row["quantity"]),
        revenue: asNumber(row["revenue"]),
      })),
    };
  }

  /** Every status/payment value is validated against the enums, so admin input cannot inject SQL. */
  static isStatus(value: string): value is OrderStatus {
    return (ORDER_STATUSES as readonly string[]).includes(value);
  }

  static isPaymentStatus(value: string): value is PaymentStatus {
    return (PAYMENT_STATUSES as readonly string[]).includes(value);
  }
}

let singleton: OrderStore | undefined;

export function orderStore(): OrderStore {
  if (!singleton) singleton = new OrderStore();
  return singleton;
}
